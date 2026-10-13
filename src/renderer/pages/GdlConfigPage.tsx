import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  Shield,
  FlaskConical,
  Building2,
  Globe,
  Eye,
  EyeOff,
  Search,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { obterPreferenciasAmbienteGdlEstritas } from '@/lib/gdl-ambiente';
import { CHAVE_HOMOLOGACAO_GDL_HABILITADA } from '@shared/gdl/ambiente';

const URL_HOMOLOGACAO = 'iishml01.pr.gov.br';
const URL_PRODUCAO = 'www.gdl.sesp.parana';
const ANO_ATUAL = new Date().getFullYear().toString();
const ANOS_OPCOES = Array.from({ length: 10 }, (_, indice) => (Number(ANO_ATUAL) - indice).toString());

interface TesteDiagnostico {
  sucesso: boolean;
  latencia: number;
  statusCode: number;
  autenticado: boolean;
  ambiente: string;
  endpointTestado: string;
  erro?: string;
  rede?: TesteDiagnosticoEtapa;
}

interface TesteDiagnosticoEtapa {
  sucesso: boolean;
  latencia: number;
  statusCode: number;
  endpointTestado: string;
  erro?: string;
}

interface ValidacaoSessaoGdl {
  ambiente: string;
  validado: boolean;
  numeroRep?: string;
  anoRep?: string;
  dataHora?: string;
}

type EstadoLeitura = 'carregando' | 'pronto' | 'erro';

function lerConfiguracaoGdl(resposta: unknown): string | null {
  if (!resposta || typeof resposta !== 'object' || !('success' in resposta) || resposta.success !== true || !('data' in resposta)) {
    throw new Error('Não foi possível ler as credenciais do GDL.');
  }
  if (resposta.data !== null && typeof resposta.data !== 'string') throw new Error('As credenciais salvas do GDL são inválidas.');
  return resposta.data;
}

function lerValidacaoGdl(resposta: unknown, ambienteEsperado: string): ValidacaoSessaoGdl {
  if (!resposta || typeof resposta !== 'object' || !('success' in resposta) || resposta.success !== true || !('data' in resposta)) {
    throw new Error('Não foi possível ler o estado de validação do GDL.');
  }
  const dados = resposta.data;
  if (!dados || typeof dados !== 'object' || !('ambiente' in dados) || typeof dados.ambiente !== 'string'
    || dados.ambiente !== (ambienteEsperado === 'producao' ? 'Produção' : 'Homologação')
    || !('validado' in dados) || typeof dados.validado !== 'boolean'
    || ('numeroRep' in dados && dados.numeroRep !== undefined && typeof dados.numeroRep !== 'string')
    || ('anoRep' in dados && dados.anoRep !== undefined && typeof dados.anoRep !== 'string')
    || ('dataHora' in dados && dados.dataHora !== undefined && typeof dados.dataHora !== 'string')) {
    throw new Error('O estado de validação do GDL é inválido.');
  }
  return {
    ambiente: dados.ambiente,
    validado: dados.validado,
    numeroRep: 'numeroRep' in dados && typeof dados.numeroRep === 'string' ? dados.numeroRep : undefined,
    anoRep: 'anoRep' in dados && typeof dados.anoRep === 'string' ? dados.anoRep : undefined,
    dataHora: 'dataHora' in dados && typeof dados.dataHora === 'string' ? dados.dataHora : undefined,
  };
}

const obterMensagemOrientadaErroGdl = (erro: string): string => {
  const erroNormalizado = erro.toUpperCase();

  if (erroNormalizado.includes('ERR_NAME_NOT_RESOLVED') || erroNormalizado.includes('ENOTFOUND')) {
    return 'Não foi possível localizar o endereço do GDL. Verifique a conexão com a VPN institucional e tente novamente.';
  }

  return erro;
};

const formatarNumeroRep = (valor: string): string => {
  const digitos = valor.replace(/\D/g, '').slice(0, 6);
  return digitos.length > 3 ? `${digitos.slice(0, -3)}.${digitos.slice(-3)}` : digitos;
};

const formatarRep = (numero: string, ano: string): string => `${formatarNumeroRep(numero)}/${ano.replace(/\D/g, '').slice(0, 4)}`;

const getMensagemErro = (erro: unknown, fallback: string): string =>
  obterMensagemOrientadaErroGdl(erro instanceof Error ? erro.message : fallback);

export const GdlConfigPage: React.FC = () => {
  const [ambiente, setAmbiente] = useState('producao');
  const [homologacaoHabilitada, setHomologacaoHabilitada] = useState(false);
  const [estadoPreferencias, setEstadoPreferencias] = useState<EstadoLeitura>('carregando');
  const [erroPreferencias, setErroPreferencias] = useState<string | null>(null);
  const [estadoCredenciais, setEstadoCredenciais] = useState<EstadoLeitura>('carregando');
  const [erroCredenciais, setErroCredenciais] = useState<string | null>(null);
  const [ambienteCredenciais, setAmbienteCredenciais] = useState<string | null>(null);
  const [estadoValidacao, setEstadoValidacao] = useState<EstadoLeitura>('carregando');
  const [erroEstadoValidacao, setErroEstadoValidacao] = useState<string | null>(null);
  const [ambienteValidacao, setAmbienteValidacao] = useState<string | null>(null);
  const [salvandoHabilitacao, setSalvandoHabilitacao] = useState(false);
  const [listagemHabilitada, setListagemHabilitada] = useState(false);
  const [preferenciaCarregada, setPreferenciaCarregada] = useState(false);
  const [salvandoListagem, setSalvandoListagem] = useState(false);
  const [erroListagem, setErroListagem] = useState<string | null>(null);
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [cpfUsuario, setCpfUsuario] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<TesteDiagnostico | null>(null);
  const [validacaoSessao, setValidacaoSessao] = useState<ValidacaoSessaoGdl | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvarErro, setSalvarErro] = useState<string | null>(null);
  const [modalValidacaoOpen, setModalValidacaoOpen] = useState(false);
  const [numeroRepValidacao, setNumeroRepValidacao] = useState('');
  const [anoRepValidacao, setAnoRepValidacao] = useState(ANO_ATUAL);
  const [anoManualValidacao, setAnoManualValidacao] = useState(false);
  const [anoManualValorValidacao, setAnoManualValorValidacao] = useState('');
  const [erroAnoManualValidacao, setErroAnoManualValidacao] = useState<string | null>(null);
  const [validandoCredenciais, setValidandoCredenciais] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [sucessoValidacao, setSucessoValidacao] = useState<string | null>(null);
  const carregamentoCredenciaisAtual = useRef(0);
  const carregamentoValidacaoAtual = useRef(0);
  const carregamentoListagemAtual = useRef(0);
  const credenciaisEditadasRef = useRef({ login: false, senha: false, cpf: false });
  const ambienteCarregadoRef = useRef<string | null>(null);
  const ambienteAtualRef = useRef(ambiente);
  ambienteAtualRef.current = ambiente;

  const carregarCredenciaisAmbiente = useCallback(async (amb: string) => {
    const carregamento = ++carregamentoCredenciaisAtual.current;
    setAmbienteCredenciais(amb);
    setEstadoCredenciais('carregando');
    setErroCredenciais(null);
    try {
      const [rLogin, rSenha, rCpf] = await Promise.all([
        window.ipcAPI.configuracao.obter(`gdl_login_${amb}`),
        window.ipcAPI.configuracao.obter(`gdl_senha_${amb}`),
        window.ipcAPI.configuracao.obter(`gdl_cpf_usuario_${amb}`),
      ]);
      if (carregamento !== carregamentoCredenciaisAtual.current || ambienteAtualRef.current !== amb) return;
      const loginLido = lerConfiguracaoGdl(rLogin) ?? '';
      const senhaLida = lerConfiguracaoGdl(rSenha) ?? '';
      const cpfLido = lerConfiguracaoGdl(rCpf) ?? '';
      if (!credenciaisEditadasRef.current.login) setLogin(loginLido);
      if (!credenciaisEditadasRef.current.senha) setSenha(senhaLida);
      if (!credenciaisEditadasRef.current.cpf) setCpfUsuario(cpfLido);
      setAmbienteCredenciais(amb);
      setEstadoCredenciais('pronto');
    } catch (falha: unknown) {
      if (carregamento !== carregamentoCredenciaisAtual.current || ambienteAtualRef.current !== amb) return;
      setErroCredenciais(getMensagemErro(falha, 'Não foi possível ler as credenciais do GDL.'));
      setEstadoCredenciais('erro');
    }
  }, []);

  const carregarConfigs = useCallback(async () => {
    setEstadoPreferencias('carregando');
    setErroPreferencias(null);
    try {
      const preferencias = await obterPreferenciasAmbienteGdlEstritas();
      setHomologacaoHabilitada(preferencias.homologacaoHabilitada);
      setAmbiente(preferencias.ambiente);
      setEstadoPreferencias('pronto');
    } catch (falha: unknown) {
      setErroPreferencias(getMensagemErro(falha, 'Não foi possível ler as preferências de ambiente do GDL.'));
      setEstadoPreferencias('erro');
    }
  }, []);

  useEffect(() => { carregarConfigs(); }, [carregarConfigs]);


  const carregarPreferenciaListagem = useCallback(async () => {
    const carregamento = ++carregamentoListagemAtual.current;
    setPreferenciaCarregada(false);
    setErroListagem(null);
    try {
      const resposta = await window.ipcAPI.gdl.obterPreferenciaListagem();
      if (carregamento !== carregamentoListagemAtual.current) return;
      if (!resposta.success || typeof resposta.data?.habilitada !== 'boolean') {
        throw new Error(resposta.error || 'Não foi possível consultar a preferência de listagem.');
      }
      setListagemHabilitada(resposta.data.habilitada);
      setPreferenciaCarregada(true);
    } catch (falha: unknown) {
      if (carregamento === carregamentoListagemAtual.current) {
        setErroListagem(getMensagemErro(falha, 'Não foi possível consultar a preferência de listagem.'));
      }
    }
  }, []);

  useEffect(() => {
    void carregarPreferenciaListagem();
    return () => { carregamentoListagemAtual.current += 1; };
  }, [carregarPreferenciaListagem]);

  const alterarListagem = async (habilitar: boolean) => {
    if (!preferenciaCarregada) return;
    setSalvandoListagem(true);
    setErroListagem(null);
    try {
      const resposta = await window.ipcAPI.gdl.definirPreferenciaListagem(habilitar);
      if (!resposta.success || resposta.data?.habilitada !== habilitar) {
        throw new Error(resposta.error || 'Não foi possível salvar a preferência de listagem.');
      }
      setListagemHabilitada(habilitar);
      toast.success(habilitar ? 'Listagem de REPs ativada.' : 'Listagem de REPs desativada.');
    } catch (falha: unknown) {
      setErroListagem(getMensagemErro(falha, 'Não foi possível salvar a preferência de listagem.'));
    } finally {
      setSalvandoListagem(false);
    }
  };

  const carregarValidacaoAmbiente = useCallback(async (amb: string) => {
    const carregamento = ++carregamentoValidacaoAtual.current;
    setAmbienteValidacao(amb);
    setEstadoValidacao('carregando');
    setErroEstadoValidacao(null);
    try {
      const resposta = await window.ipcAPI.gdl.obterValidacaoSessao(amb);
      if (carregamento !== carregamentoValidacaoAtual.current || ambienteAtualRef.current !== amb) return;
      const validacao = lerValidacaoGdl(resposta, amb);
      setValidacaoSessao(validacao);
      setAmbienteValidacao(amb);
      setEstadoValidacao('pronto');
    } catch (falha: unknown) {
      if (carregamento !== carregamentoValidacaoAtual.current || ambienteAtualRef.current !== amb) return;
      setErroEstadoValidacao(getMensagemErro(falha, 'Não foi possível ler o estado de validação do GDL.'));
      setEstadoValidacao('erro');
    }
  }, []);

  useEffect(() => {
    if (estadoPreferencias !== 'pronto') return;
    if (ambienteCarregadoRef.current !== ambiente) {
      credenciaisEditadasRef.current = { login: false, senha: false, cpf: false };
      setLogin('');
      setSenha('');
      setCpfUsuario('');
      ambienteCarregadoRef.current = ambiente;
    }
    setAmbienteCredenciais(null);
    setValidacaoSessao(null);
    setAmbienteValidacao(null);
    setDiagnostico(null);
    setModalValidacaoOpen(false);
    void carregarCredenciaisAmbiente(ambiente);
    void carregarValidacaoAmbiente(ambiente);
    return () => {
      carregamentoCredenciaisAtual.current += 1;
      carregamentoValidacaoAtual.current += 1;
    };
  }, [ambiente, estadoPreferencias, carregarCredenciaisAmbiente, carregarValidacaoAmbiente]);

  const credenciaisProntas = estadoPreferencias === 'pronto' && estadoCredenciais === 'pronto' && ambienteCredenciais === ambiente;
  const validacaoPronta = estadoPreferencias === 'pronto' && estadoValidacao === 'pronto' && ambienteValidacao === ambiente;

  const formatarCPF = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };

  const handleSalvar = async () => {
    if (!credenciaisProntas) return;
    setErro(null);
    setSalvarErro(null);

    const ambLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';
    const loginNormalizado = login.trim();
    const senhaNormalizada = senha.trim();
    const cpfUsuarioNormalizado = cpfUsuario.replace(/\D/g, '');

    if (!loginNormalizado || !senhaNormalizada) {
      const faltantes: string[] = [];
      if (!loginNormalizado) faltantes.push('login');
      if (!senhaNormalizada) faltantes.push('senha');
      setSalvarErro(`Preencha ${faltantes.join(' e ')} de ${ambLabel} para consultas.`);
      return;
    }

    setLogin(loginNormalizado);
    setSenha(senhaNormalizada);
    setCpfUsuario(formatarCPF(cpfUsuarioNormalizado));
    setSalvando(true);
    try {
      const respostasCredenciais = await Promise.all([
        window.ipcAPI.configuracao.salvar(`gdl_login_${ambiente}`, loginNormalizado, 'texto', `Login GDL (${ambLabel})`),
        window.ipcAPI.configuracao.salvar(`gdl_senha_${ambiente}`, senhaNormalizada, 'senha', `Senha GDL (${ambLabel})`),
        window.ipcAPI.configuracao.salvar(`gdl_cpf_usuario_${ambiente}`, cpfUsuarioNormalizado, 'texto', `CPF usuário GDL (${ambLabel})`),
      ]);
      const falhaCredencial = respostasCredenciais.find(resposta => !resposta.success);
      if (falhaCredencial) throw new Error(falhaCredencial.error || 'Não foi possível salvar as credenciais.');
      const respostaAmbiente = await window.ipcAPI.configuracao.salvar('gdl_ambiente', ambiente, 'texto', 'Ambiente da API GDL');
      if (!respostaAmbiente.success) throw new Error(respostaAmbiente.error || 'Não foi possível selecionar o ambiente.');
      carregamentoValidacaoAtual.current += 1;
      setEstadoValidacao('carregando');
      const rValidacao = await window.ipcAPI.gdl.limparValidacaoSessao(ambiente);
      if (ambienteAtualRef.current === ambiente) {
        try {
          const validacao = lerValidacaoGdl(rValidacao, ambiente);
          setValidacaoSessao(validacao);
          setAmbienteValidacao(ambiente);
          setErroEstadoValidacao(null);
          setEstadoValidacao('pronto');
        } catch (falha: unknown) {
          setErroEstadoValidacao(getMensagemErro(falha, 'Não foi possível ler o estado de validação do GDL.'));
          setEstadoValidacao('erro');
        }
      }
      toast.success(`Credenciais de ${ambLabel} salvas com sucesso!`);
    } catch (e: unknown) {
      setErro(getMensagemErro(e, 'Erro ao salvar configurações'));
    } finally {
      setSalvando(false);
    }
  };

  const handleHabilitarHomologacao = async (habilitar: boolean) => {
    if (estadoPreferencias !== 'pronto') return;
    setErro(null);
    setSalvandoHabilitacao(true);
    try {
      if (habilitar) {
        const respostaAmbiente = await window.ipcAPI.configuracao.salvar('gdl_ambiente', 'producao', 'texto', 'Ambiente da API GDL');
        if (!respostaAmbiente.success) throw new Error(respostaAmbiente.error || 'Não foi possível selecionar Produção.');
      }
      const resposta = await window.ipcAPI.configuracao.salvar(
        CHAVE_HOMOLOGACAO_GDL_HABILITADA,
        String(habilitar),
        'texto',
        'Habilitação do ambiente de homologação GDL',
      );
      if (!resposta.success) throw new Error(resposta.error || 'Não foi possível salvar a preferência.');
      if (!habilitar) {
        const respostaAmbiente = await window.ipcAPI.configuracao.salvar('gdl_ambiente', 'producao', 'texto', 'Ambiente da API GDL');
        if (!respostaAmbiente.success) throw new Error(respostaAmbiente.error || 'Não foi possível selecionar Produção.');
        setAmbiente('producao');
        setDiagnostico(null);
        setValidacaoSessao(null);
      }
      setHomologacaoHabilitada(habilitar);

    } catch (falha: unknown) {
      setErro(getMensagemErro(falha, 'Não foi possível atualizar o acesso à Homologação.'));
    } finally {
      setSalvandoHabilitacao(false);
    }
  };

  const handleTestar = async () => {
    if (!credenciaisProntas) return;
    const ambienteTeste = ambiente;
    setErro(null);
    setSalvarErro(null);
    setDiagnostico(null);
    setTestando(true);
    try {
      const r = await window.ipcAPI.gdl.testarConexao(ambiente);
      if (ambienteAtualRef.current !== ambienteTeste) return;
      if (r.success && r.data) {
        setDiagnostico(r.data);
      } else {
        setErro(obterMensagemOrientadaErroGdl(r.error || 'Erro ao testar conexão'));
      }
    } catch (e: unknown) {
      if (ambienteAtualRef.current === ambienteTeste) setErro(getMensagemErro(e, 'Erro ao testar conexão'));
    } finally {
      setTestando(false);
    }
  };

  const abrirModalValidacao = () => {
    if (!credenciaisProntas || !validacaoPronta) return;
    setErroValidacao(null);
    setSucessoValidacao(null);
    setNumeroRepValidacao('');
    setAnoRepValidacao(ANO_ATUAL);
    setAnoManualValidacao(false);
    setAnoManualValorValidacao('');
    setErroAnoManualValidacao(null);
    setModalValidacaoOpen(true);
  };

  const handleAnoValidacaoChange = (valor: string) => {
    if (valor === 'manual') {
      setAnoManualValidacao(true);
      setAnoRepValidacao('');
      setAnoManualValorValidacao('');
    } else {
      setAnoManualValidacao(false);
      setAnoRepValidacao(valor);
      setAnoManualValorValidacao('');
    }
    setErroAnoManualValidacao(null);
  };

  const handleAnoManualValidacaoChange = (valor: string) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 4);
    setAnoManualValorValidacao(digitos);
    if (digitos.length === 4) {
      setAnoRepValidacao(digitos);
      setErroAnoManualValidacao(null);
    } else {
      setAnoRepValidacao('');
      setErroAnoManualValidacao(digitos ? 'Ano deve ter 4 dígitos.' : null);
    }
  };

  const handleValidarCredenciais = async () => {
    if (!credenciaisProntas || !validacaoPronta) return;
    const ambienteValidado = ambiente;
    setErroValidacao(null);
    setSucessoValidacao(null);

    if (!login.trim() || !senha.trim()) {
      setErroValidacao('Preencha login e senha antes de validar as credenciais.');
      return;
    }

    if (!numeroRepValidacao.trim() || !anoRepValidacao.trim()) {
      setErroValidacao('Informe número e ano de uma REP válida para validar as credenciais.');
      return;
    }

    setValidandoCredenciais(true);
    try {
      const r = await window.ipcAPI.gdl.validarCredenciais(
        ambiente,
        {
          login,
          senha,
          cpfUsuario,
        },
        numeroRepValidacao.trim(),
        anoRepValidacao.trim(),
      );
      if (ambienteAtualRef.current !== ambienteValidado) return;

      if (r.success && r.data) {
        const rSessao = await window.ipcAPI.gdl.obterValidacaoSessao(ambiente);
        if (ambienteAtualRef.current !== ambienteValidado) return;
        const validacao = lerValidacaoGdl(rSessao, ambienteValidado);
        setValidacaoSessao(validacao);
        setAmbienteValidacao(ambienteValidado);
        setSucessoValidacao(`Credenciais validadas com sucesso usando a REP ${formatarRep(numeroRepValidacao, anoRepValidacao)}.`);
      } else {
        setErroValidacao(obterMensagemOrientadaErroGdl(r.error || 'Não foi possível validar as credenciais no GDL.'));
      }
    } catch (e: unknown) {
      if (ambienteAtualRef.current === ambienteValidado) {
        setErroValidacao(getMensagemErro(e, 'Erro ao validar credenciais no GDL.'));
        setErroEstadoValidacao('Não foi possível confirmar o estado de validação. Tente consultar novamente.');
        setEstadoValidacao('erro');
      }
    } finally {
      setValidandoCredenciais(false);
    }
  };

  const isHomologacao = ambiente === 'homologacao';
  const ambienteConfirmado = estadoPreferencias === 'pronto';
  const ambienteLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';
  const valorSelectAnoValidacao = anoManualValidacao ? 'manual' : (anoRepValidacao || undefined);
  const formatarEndpoint = (endpoint: string) => endpoint ? endpoint.replace(endpoint.split('/api')[0], '') : '—';
  const formatarDataHora = (dataHora?: string) => {
    if (!dataHora) return '—';
    const data = new Date(dataHora);
    if (Number.isNaN(data.getTime())) return dataHora;
    return data.toLocaleString('pt-BR');
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          API GDL
          <Badge variant={estadoPreferencias === 'pronto' && ambiente === 'producao' ? 'default' : 'secondary'} className="text-xs">
            {estadoPreferencias === 'pronto' ? `Ambiente selecionado: ${ambienteLabel}` : 'Ambiente não confirmado'}
          </Badge>
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure o acesso à API do GDL para consulta automática de dados de REPs.
        </p>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {estadoPreferencias !== 'pronto' && (
        <Alert variant={estadoPreferencias === 'erro' ? 'destructive' : 'default'}>
          <AlertDescription className="flex items-center gap-3">
            {estadoPreferencias === 'erro' ? erroPreferencias : 'Carregando preferências de ambiente do GDL...'}
            {estadoPreferencias === 'erro' && <Button type="button" variant="outline" size="sm" onClick={() => void carregarConfigs()}>Tentar novamente</Button>}
          </AlertDescription>
        </Alert>
      )}

      <Card id="gdl-listagem-reps">
        <CardHeader>
          <CardTitle>Listagem de REPs</CardTitle>
          <CardDescription>
            Controla a lista do Dashboard e de REPs → Listar REPs nesta instalação. A consulta e a importação de uma REP individual continuam disponíveis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {!preferenciaCarregada
              ? 'Preferência de listagem não confirmada.'
              : listagemHabilitada
              ? 'Ativada: as listas são atualizadas pelo GDL e os exames são identificados pelo catálogo local.'
              : 'Desativada: as listas mostram apenas cache com menos de 30 minutos e não consultam o GDL.'}
          </p>
          {erroListagem && <Alert variant="destructive"><AlertDescription className="flex items-center gap-3">{erroListagem}<Button type="button" variant="outline" size="sm" onClick={() => void carregarPreferenciaListagem()}>Tentar novamente</Button></AlertDescription></Alert>}
          <Button
            type="button"
            variant={listagemHabilitada ? 'outline' : 'default'}
            aria-pressed={listagemHabilitada}
            disabled={!preferenciaCarregada || salvandoListagem}
            onClick={() => void alterarListagem(!listagemHabilitada)}
          >
            {salvandoListagem ? 'Salvando...' : listagemHabilitada ? 'Desativar listagem' : 'Ativar listagem'}
          </Button>
        </CardContent>
      </Card>



      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Conexão</CardTitle>
            <CardDescription>
              Credenciais de acesso à API REST do GDL. A senha é armazenada criptografada.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={homologacaoHabilitada ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2 self-start sm:shrink-0"
            aria-pressed={homologacaoHabilitada}
            disabled={estadoPreferencias !== 'pronto' || salvandoHabilitacao || salvando}
            onClick={() => void handleHabilitarHomologacao(!homologacaoHabilitada)}
          >
            <FlaskConical className="h-4 w-4" />
            {salvandoHabilitacao
              ? 'Salvando...'
              : homologacaoHabilitada
                ? 'Desabilitar ambiente de homologação'
                : 'Habilitar ambiente de homologação'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {!credenciaisProntas && estadoPreferencias === 'pronto' && (
            <Alert variant={estadoCredenciais === 'erro' && ambienteCredenciais === ambiente ? 'destructive' : 'default'}>
              <AlertDescription className="flex items-center gap-3">
                {estadoCredenciais === 'erro' ? erroCredenciais : 'Carregando credenciais do ambiente...'}
                {estadoCredenciais === 'erro' && <Button type="button" variant="outline" size="sm" onClick={() => void carregarCredenciaisAmbiente(ambiente)}>Tentar novamente</Button>}
              </AlertDescription>
            </Alert>
          )}
          {credenciaisProntas && !login && !senha && (
            <p className="text-sm text-muted-foreground">Não há login e senha salvos para este ambiente.</p>
          )}
          {/* ---------- Seleção de ambiente com cards ---------- */}
          <div className="space-y-3">
            <Label>Ambiente</Label>
            <div className={`grid grid-cols-1 gap-3 ${homologacaoHabilitada ? 'sm:grid-cols-2' : ''}`}>
              {/* Card Homologação */}
              {homologacaoHabilitada && (
              <button
                type="button"
                disabled={estadoPreferencias !== 'pronto' || salvando || testando || validandoCredenciais || salvandoHabilitacao}
                onClick={() => setAmbiente('homologacao')}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  ambienteConfirmado && isHomologacao
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-muted-foreground/20 hover:border-muted-foreground/40 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className={`h-5 w-5 ${isHomologacao ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`font-semibold text-sm ${isHomologacao ? 'text-primary' : ''}`}>
                    Homologação
                  </span>
                  {ambienteConfirmado && isHomologacao && (
                    <Badge variant="default" className="ml-auto text-xs">Ativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  <Globe className="h-3 w-3 inline mr-1" />
                  {URL_HOMOLOGACAO}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ambiente de testes. Dados não refletem produção.
                </p>
              </button>
              )}

              {/* Card Produção */}
              <button
                type="button"
                disabled={estadoPreferencias !== 'pronto' || salvando || testando || validandoCredenciais || salvandoHabilitacao}
                onClick={() => setAmbiente('producao')}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  ambienteConfirmado && !isHomologacao
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-muted-foreground/20 hover:border-muted-foreground/40 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className={`h-5 w-5 ${!isHomologacao ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`font-semibold text-sm ${!isHomologacao ? 'text-primary' : ''}`}>
                    Produção
                  </span>
                  {!isHomologacao && estadoPreferencias === 'pronto' && (
                    <Badge variant="default" className="ml-auto text-xs">Ativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  <Globe className="h-3 w-3 inline mr-1" />
                  {URL_PRODUCAO}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ambiente real. Requer VPN da Polícia Científica.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gdl-login">Login</Label>
              <Input
                id="gdl-login"
                value={login}
                onChange={e => { credenciaisEditadasRef.current.login = true; setLogin(e.target.value); }}
                placeholder={estadoCredenciais === 'erro' ? 'Leitura indisponível' : 'Seu usuário do GDL'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gdl-senha">Senha</Label>
              <div className="relative">
                <Input
                  id="gdl-senha"
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={e => { credenciaisEditadasRef.current.senha = true; setSenha(e.target.value); }}
                  placeholder={estadoCredenciais === 'erro' ? 'Leitura indisponível' : '••••••••'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gdl-cpf">CPF do Usuário</Label>
            <Input
              id="gdl-cpf"
              value={cpfUsuario}
              onChange={e => { credenciaisEditadasRef.current.cpf = true; setCpfUsuario(formatarCPF(e.target.value)); }}
              placeholder="000.000.000-00"
              maxLength={14}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Algumas consultas à API GDL podem exigir o CPF do usuário.
              Se não preenchido, o header <code className="bg-muted px-1 rounded">cpfUsuario</code> não será enviado.
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSalvar} disabled={!credenciaisProntas || salvando || salvandoHabilitacao} className="gap-2">
              <Shield className="h-4 w-4" />
              {salvando ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>

          {salvarErro && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{salvarErro}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  Teste de Rede
                </CardTitle>
                <CardDescription>
                  Verifica se o ambiente {ambienteLabel} está acessível pela rede.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {diagnostico ? (
                  <div className={`rounded-lg border p-3 space-y-3 ${diagnostico.sucesso ? 'border-green-300 dark:border-green-800' : 'border-red-300 dark:border-red-800'}`}>
                    <div className="flex items-center gap-2">
                      {diagnostico.sucesso ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium text-sm">
                        {diagnostico.sucesso ? 'Rede acessível' : 'Falha na rede'}
                      </span>
                      <Badge variant={diagnostico.sucesso ? 'secondary' : 'destructive'} className="text-xs ml-auto">
                        {diagnostico.sucesso ? 'OK' : 'Falha'}
                      </Badge>
                    </div>

                    {diagnostico.rede ? (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Latência</span>
                        <span>{diagnostico.rede.latencia}ms</span>
                        <span className="text-muted-foreground">HTTP</span>
                        <span>{diagnostico.rede.statusCode || '—'}</span>
                        <span className="text-muted-foreground">Endpoint</span>
                        <span className="truncate font-mono text-xs" title={diagnostico.rede.endpointTestado}>
                          {formatarEndpoint(diagnostico.rede.endpointTestado)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {diagnostico.erro ? obterMensagemOrientadaErroGdl(diagnostico.erro) : 'Ainda não executado.'}
                      </p>
                    )}

                    {(diagnostico.rede?.erro || diagnostico.erro) && (
                      <p className="text-sm text-red-600">
                        {obterMensagemOrientadaErroGdl(diagnostico.rede?.erro || diagnostico.erro || '')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Execute o teste para verificar conectividade com o ambiente selecionado.
                  </p>
                )}

                <Button variant="outline" onClick={handleTestar} disabled={!credenciaisProntas || testando} className="gap-2 w-full">
                  <Wifi className="h-4 w-4" />
                  {testando ? 'Testando...' : 'Testar Rede'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Validação de Credenciais
                </CardTitle>
                <CardDescription>
                  Confirma as credenciais com uma consulta real de REP no ambiente atual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(!validacaoPronta || !credenciaisProntas) && estadoPreferencias === 'pronto' && (
                  <Alert variant={estadoValidacao === 'erro' ? 'destructive' : 'default'}>
                    <AlertDescription className="flex items-center gap-3">
                      {estadoValidacao === 'erro' ? erroEstadoValidacao : 'Carregando o estado de validação...'}
                      {estadoValidacao === 'erro' && <Button type="button" variant="outline" size="sm" onClick={() => void carregarValidacaoAmbiente(ambiente)}>Tentar novamente</Button>}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Status da sessão</span>
                    <Badge variant={validacaoPronta && validacaoSessao?.validado ? 'default' : 'secondary'} className="text-xs ml-auto">
                      {!validacaoPronta ? 'Indisponível' : validacaoSessao?.validado ? 'Validada' : 'Pendente'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {!validacaoPronta
                      ? 'O estado de validação ainda não foi confirmado.'
                      : validacaoSessao?.validado
                      ? `Credenciais validadas nesta sessão com a REP ${formatarRep(validacaoSessao.numeroRep || '', validacaoSessao.anoRep || '')}.`
                      : 'A validação de credenciais acontece quando uma REP válida é consultada com sucesso no ambiente atual.'}
                  </p>
                  {validacaoPronta && validacaoSessao?.validado && (
                    <p className="text-xs text-muted-foreground">
                      Última validação: {formatarDataHora(validacaoSessao.dataHora)}
                    </p>
                  )}
                </div>

                <Button variant="outline" onClick={abrirModalValidacao} disabled={!credenciaisProntas || !validacaoPronta} className="gap-2 w-full">
                  <Search className="h-4 w-4" />
                  Validar Credenciais
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalValidacaoOpen} onOpenChange={setModalValidacaoOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Validar credenciais GDL</DialogTitle>
            <DialogDescription>
              Informe uma REP existente no ambiente {ambienteLabel} para validar as credenciais atuais sem precisar salvar antes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validacao-numero-rep">Nº da REP</Label>
                <Input
                  id="validacao-numero-rep"
                  value={numeroRepValidacao}
                  onChange={(e) => setNumeroRepValidacao(formatarNumeroRep(e.target.value))}
                  placeholder="123.456"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validacao-ano-rep">Ano</Label>
                <Select value={valorSelectAnoValidacao} onValueChange={handleAnoValidacaoChange}>
                  <SelectTrigger id="validacao-ano-rep">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="!max-h-[150px]">
                    {ANOS_OPCOES.map(ano => (
                      <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                    ))}
                    <SelectItem value="manual">Digitar manualmente...</SelectItem>
                  </SelectContent>
                </Select>
                {anoManualValidacao && (
                  <div className="pt-2">
                    <Input
                      value={anoManualValorValidacao}
                      onChange={e => handleAnoManualValidacaoChange(e.target.value)}
                      placeholder="Ex: 2024"
                      maxLength={4}
                      inputMode="numeric"
                      className={erroAnoManualValidacao ? 'border-destructive' : ''}
                    />
                    {erroAnoManualValidacao && (
                      <p className="mt-1 text-xs text-destructive">{erroAnoManualValidacao}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {erroValidacao && (
              <Alert variant="destructive">
                <AlertDescription>{erroValidacao}</AlertDescription>
              </Alert>
            )}

            {sucessoValidacao && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>{sucessoValidacao}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalValidacaoOpen(false)} disabled={validandoCredenciais}>
                Fechar
              </Button>
              <Button onClick={handleValidarCredenciais} disabled={!credenciaisProntas || !validacaoPronta || validandoCredenciais} className="gap-2">
                {validandoCredenciais ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {validandoCredenciais ? 'Validando...' : 'Validar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

