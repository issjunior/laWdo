import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Network,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ListChecks,
  CheckSquare,
  Square,
  Mail,
  FileText,
  UsersRound,
  ClipboardList,
} from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import type {
  DadosImportacaoB602,
  PecaB602,
  ReferenciaOrigemGdl,
  ResultadoImportacaoExame,
} from '@shared/types/b602-gdl.types';
import { combinarEnvolvido, separarEnvolvido } from '@shared/utils/envolvido';
import { montarItensReconciliacaoPecasB602 } from '@/components/rep/exam-fields/pecas-b602.utils';

const ANO_SCHEMA = z.string().regex(/^\d{4}$/, 'Ano deve ter 4 dígitos');
const EMAIL_SUPORTE_LAWDO = 'izaias.santos@policiacientifica.pr.gov.br';

const ANO_ATUAL = new Date().getFullYear();
const ANOS_OPCOES = Array.from({ length: 10 }, (_, i) => (ANO_ATUAL - i).toString());

const formatarNumeroRep = (valor: string): string => {
  const digitos = valor.replace(/\D/g, '').slice(0, 6);
  return digitos.length > 3 ? `${digitos.slice(0, -3)}.${digitos.slice(-3)}` : digitos;
};

const separarAvisoNaturezaEmDesenvolvimento = (mensagem: string) => {
  const correspondencia = mensagem.match(
    /^(O formulário para a natureza de exame )(.+?)( ainda está em desenvolvimento no laWdo\. Os dados não foram importados\.)$/,
  );

  if (!correspondencia) return null;

  return {
    prefixo: correspondencia[1],
    naturezaExame: correspondencia[2],
    sufixo: correspondencia[3],
  };
};

interface CampoMapeado {
  campo: string;
  label: string;
  valor: string;
}

interface OrigemCandidata {
  indice: number;
  origem: ReferenciaOrigemGdl;
}

interface EnvolvidoRevisao {
  indice: number;
  qualificacao: string;
  nome: string;
}

interface GdlConsultaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAplicar: (
    resultado: ResultadoImportacaoExame<DadosImportacaoB602>,
    modo: 'substituir' | 'mesclar',
    pecasImportadasSelecionadas: PecaB602[],
  ) => void | Promise<void>;
  temDadosExistentes: boolean;
  pecasB602: PecaB602[];
  onConfigurarCredenciais: () => void;
}

type Passo = 'busca' | 'revisao';

interface PreTesteResultado {
  ok: boolean;
  latencia: number;
  ambiente: string;
  statusCode: number;
  autenticado: boolean;
  erro?: string;
  rede?: PreTesteEtapa;
}

interface PreTesteEtapa {
  sucesso: boolean;
  latencia: number;
  statusCode: number;
  endpointTestado: string;
  erro?: string;
}

interface GdlTesteRespostaApi {
  sucesso: boolean;
  latencia: number;
  ambiente: string;
  statusCode: number;
  autenticado: boolean;
  erro?: string;
  rede?: PreTesteEtapa;
}

const getMensagemErro = (erro: unknown, fallback: string): string =>
  erro instanceof Error ? erro.message : fallback;

function formatarDataRevisao(valor: string): string {
  const data = new Date(valor.includes('T') ? valor : `${valor}T00:00:00`)
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString('pt-BR')
}

function normalizarTipoOrigem(tipo: string): string {
  return tipo.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/[\s/_-]/g, '')
}

function origemPertenceFamiliaPreferencial(origem: ReferenciaOrigemGdl): boolean {
  const tipo = normalizarTipoOrigem(origem.tipo)
  return tipo.startsWith('bo') || tipo.startsWith('ip') || tipo.startsWith('oficio')
}

function obterOrigensCandidatas(origens: ReferenciaOrigemGdl[]): OrigemCandidata[] {
  const preferenciais = origens.filter(origemPertenceFamiliaPreferencial)
  const origemBase = preferenciais.length > 0 ? preferenciais : origens

  return origemBase.map(origem => ({ indice: origens.indexOf(origem), origem }))
}

function obterIndiceOrigemSelecionada(resultado: ResultadoImportacaoExame<DadosImportacaoB602>): number | null {
  const { tipo_solicitacao: tipo, numero_documento: numero, data_documento: dataDocumento } = resultado.camposGerais
  const indice = resultado.camposEspecificos.dadosSolicitacao.origensDisponiveis.findIndex(origem => (
    origem.tipo === tipo
    && origem.numero === numero
    && (origem.dataDocumento ?? '') === (dataDocumento ?? '')
  ))
  return indice >= 0 ? indice : null
}

function formatarOpcaoOrigem(origem: ReferenciaOrigemGdl): string {
  const partes = [origem.tipo, origem.numero]
  if (origem.dataDocumento) partes.push(formatarDataRevisao(origem.dataDocumento))
  return partes.join(' — ')
}

function montarCamposMapeados(
  resultado: ResultadoImportacaoExame<DadosImportacaoB602>,
  origemSelecionada?: ReferenciaOrigemGdl,
): CampoMapeado[] {
  const camposGerais: Record<string, string> = {
    ...resultado.camposGerais,
    ...(origemSelecionada ? {
      tipo_solicitacao: origemSelecionada.tipo,
      numero_documento: origemSelecionada.numero,
      data_documento: origemSelecionada.dataDocumento ?? '',
    } : {}),
  }
  const tiposBo = [...new Set(resultado.camposEspecificos.dadosInvestigacao.boletinsOcorrencia.map(referencia => referencia.tipo))]
  const tiposIp = [...new Set(resultado.camposEspecificos.dadosInvestigacao.inqueritosPoliciais.map(referencia => referencia.tipo))]
  const labelsCampos: Record<string, string> = {
    numero: 'Nº da REP',
    tipo_solicitacao: 'Tipo de Solicitação',
    numero_documento: 'Nº da Solicitação',
    data_documento: 'Data do Documento',
    data_requisicao: 'Data de Recebimento',
    observacoes: 'Quesito Aberto',
    b602_local_cidade: 'Cidade',
    b602_solicitante_nome: 'Unidade Policial',
    autoridade_solicitante: 'Autoridade Solicitante',
    local_fato: 'Local do Fato',
    latitude: 'Latitude',
    longitude: 'Longitude',
    b602_numero_bo: tiposBo.length ? `Nº BO (${tiposBo.join(', ')})` : 'Nº BO',
    b602_numero_ip: tiposIp.length ? `Nº IP (${tiposIp.join(', ')})` : 'Nº IP',
  }
  const campos = Object.entries(camposGerais)
    .filter(([campo, valor]) => !campo.startsWith('b602_envolvidos_') && Boolean(valor))
    .map(([campo, valor]) => ({
      campo,
      label: labelsCampos[campo] ?? campo,
      valor: campo === 'data_requisicao' || campo === 'data_documento'
        ? formatarDataRevisao(valor)
        : valor,
    }))

  const envolvidos = Array.from({ length: 10 }, (_, indice) => combinarEnvolvido(
    camposGerais[`b602_envolvidos_qualificacao_${indice}`] || '',
    camposGerais[`b602_envolvidos_${indice}`] || '',
  ))
    .filter(Boolean)
    .join('\n')
  if (envolvidos) campos.push({ campo: 'envolvidos', label: 'Envolvidos', valor: envolvidos })

  return campos
}

function montarCamposNaoPreenchidos(camposMapeados: CampoMapeado[]): string[] {
  const todosCampos = [
    { campo: 'autoridade_solicitante', label: 'Autoridade Solicitante' },
    { campo: 'local_fato', label: 'Local do Fato' },
    { campo: 'latitude', label: 'Latitude' },
    { campo: 'longitude', label: 'Longitude' },
    { campo: 'envolvidos', label: 'Envolvidos' },
    { campo: 'b602_numero_bo', label: 'Nº BO' },
    { campo: 'b602_numero_ip', label: 'Nº IP' },
    { campo: 'veiculo', label: 'Veículo' },
    { campo: 'placa', label: 'Placa' },
    { campo: 'chassi', label: 'Chassi' },
    { campo: 'motor', label: 'Motor' },
  ]

  return todosCampos
    .filter(({ campo }) => !camposMapeados.some(mapeado => mapeado.campo === campo))
    .map(({ label }) => label)
}

function montarEnvolvidosRevisao(
  resultado: ResultadoImportacaoExame<DadosImportacaoB602> | null,
): EnvolvidoRevisao[] {
  if (!resultado) return []

  const envolvidosGdl = resultado.camposEspecificos.dadosInvestigacao.envolvidos
  const quantidade = Math.max(envolvidosGdl.length, 10)
  return Array.from({ length: quantidade }, (_, indice) => {
    const valorOriginal = envolvidosGdl[indice] ?? ''
    const partesOriginais = separarEnvolvido(valorOriginal)
    const nomePreenchido = resultado.camposGerais[`b602_envolvidos_${indice}`]?.trim() ?? ''
    const qualificacaoPreenchida = resultado.camposGerais[`b602_envolvidos_qualificacao_${indice}`]?.trim() ?? ''
    const nome = nomePreenchido || partesOriginais.nome
    const qualificacao = qualificacaoPreenchida || partesOriginais.qualificacao
    return {
      indice,
      qualificacao,
      nome,
    }
  }).filter(envolvido => Boolean(envolvido.nome))
}

function ListaCamposRevisao({
  campos,
  className = 'sm:grid-cols-2',
}: {
  campos: CampoMapeado[];
  className?: string;
}): React.ReactElement | null {
  if (campos.length === 0) return null

  return (
    <dl className={`grid grid-cols-1 gap-x-4 gap-y-2 ${className}`}>
      {campos.map(campo => (
        <div key={campo.campo} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{campo.label}</dt>
          <dd className="break-words text-sm font-medium leading-5">{campo.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

export const GdlConsultaModal: React.FC<GdlConsultaModalProps> = ({
  open,
  onOpenChange,
  onAplicar,
  temDadosExistentes,
  pecasB602,
  onConfigurarCredenciais,
}) => {
  const [passo, setPasso] = useState<Passo>('busca');
  const [numeroRep, setNumeroRep] = useState('');
  const [anoRep, setAnoRep] = useState(ANO_ATUAL.toString());
  const [anoManual, setAnoManual] = useState(false);
  const [anoManualValor, setAnoManualValor] = useState('');
  const [anoManualErro, setAnoManualErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<'substituir' | 'mesclar'>('mesclar');

  const [preTeste, setPreTeste] = useState<PreTesteResultado | null>(null);
  const [preTesteTestando, setPreTesteTestando] = useState(false);
  const [ambiente, setAmbiente] = useState<string>('homologacao');
  const [ambienteCarregado, setAmbienteCarregado] = useState(false);

  const [resultadoConsulta, setResultadoConsulta] = useState<ResultadoImportacaoExame<DadosImportacaoB602> | null>(null);
  const [idsPecasSelecionadas, setIdsPecasSelecionadas] = useState<Set<string>>(new Set());
  const [indicesEnvolvidosSelecionados, setIndicesEnvolvidosSelecionados] = useState<Set<number>>(new Set());
  const [indiceOrigemSelecionada, setIndiceOrigemSelecionada] = useState<number | null>(null);
  const [camposMapeados, setCamposMapeados] = useState<CampoMapeado[]>([]);
  const [camposNaoPreenchidos, setCamposNaoPreenchidos] = useState<string[]>([]);
  const avisoNaturezaEmDesenvolvimento = erro
    ? separarAvisoNaturezaEmDesenvolvimento(erro)
    : null;

  const montarPreTeste = (data: GdlTesteRespostaApi): PreTesteResultado => ({
    ok: data.sucesso,
    latencia: data.latencia,
    ambiente: data.ambiente,
    statusCode: data.statusCode,
    autenticado: data.autenticado,
    erro: data.erro,
    rede: data.rede,
  });

  const handleTestarConexao = useCallback(async () => {
    setPreTesteTestando(true);
    try {
      const r = await window.ipcAPI.gdl.testarConexao(ambiente);
      if (r.success && r.data) {
        setPreTeste(montarPreTeste(r.data));
      } else {
        setPreTeste({
          ok: false,
          latencia: 0,
          ambiente: '',
          statusCode: 0,
          autenticado: false,
          erro: r.error || 'Erro ao testar conexão',
        });
      }
    } catch {
      setPreTeste({
        ok: false,
        latencia: 0,
        ambiente: '',
        statusCode: 0,
        autenticado: false,
        erro: 'Erro ao testar conexão com GDL',
      });
    } finally {
      setPreTesteTestando(false);
    }
  }, [ambiente]);

  useEffect(() => {
    if (open) {
      setPasso('busca');
      setNumeroRep('');
      setAnoRep(ANO_ATUAL.toString());
      setAnoManual(false);
      setAnoManualValor('');
      setAnoManualErro(null);
      setErro(null);
      setAplicando(false);
      setResultadoConsulta(null);
      setIdsPecasSelecionadas(new Set());
      setIndiceOrigemSelecionada(null);
      setCamposMapeados([]);
      setCamposNaoPreenchidos([]);
      setModo('mesclar');
      setPreTeste(null);
      setAmbienteCarregado(false);

      (async () => {
        const rAmb = await window.ipcAPI.configuracao.obter('gdl_ambiente');
        const amb = (rAmb.success && rAmb.data) ? rAmb.data : 'homologacao';
        setAmbiente(amb);
        setAmbienteCarregado(true);

        setPreTesteTestando(true);
        try {
          const r = await window.ipcAPI.gdl.testarConexao(amb);
          if (r.success && r.data) {
            setPreTeste(montarPreTeste(r.data));
          } else {
            setPreTeste({
              ok: false,
              latencia: 0,
              ambiente: '',
              statusCode: 0,
              autenticado: false,
              erro: r.error || 'Erro ao testar conexão',
            });
          }
        } catch {
          setPreTeste({
            ok: false,
            latencia: 0,
            ambiente: '',
            statusCode: 0,
            autenticado: false,
            erro: 'Erro ao testar conexão com GDL',
          });
        } finally {
          setPreTesteTestando(false);
        }
      })();
    }
  }, [open]);

  const handleAnoChange = (value: string) => {
    if (value === 'manual') {
      setAnoManual(true);
      setAnoRep('');
      setAnoManualValor('');
      setAnoManualErro(null);
    } else {
      setAnoManual(false);
      setAnoRep(value);
      setAnoManualValor('');
      setAnoManualErro(null);
    }
  };

  const handleAnoManualChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setAnoManualValor(digits);
    if (digits.length === 4) {
      const result = ANO_SCHEMA.safeParse(digits);
      if (result.success) {
        setAnoManualErro(null);
        setAnoRep(digits);
      } else {
        setAnoManualErro(result.error.issues[0].message);
        setAnoRep('');
      }
    } else if (digits.length > 0) {
      setAnoManualErro('Ano deve ter 4 dígitos');
      setAnoRep('');
    } else {
      setAnoManualErro(null);
      setAnoRep('');
    }
  };

  const handleBuscar = async () => {
    setErro(null);
    setBuscando(true);
    try {
      const r = await window.ipcAPI.gdl.consultarRep(numeroRep.trim(), anoRep.trim());
      if (r.success && r.data) {
        const resultado: ResultadoImportacaoExame<DadosImportacaoB602> = r.data;
        const indiceOrigemInicial = obterIndiceOrigemSelecionada(resultado);
        const origemInicial = indiceOrigemInicial === null
          ? undefined
          : resultado.camposEspecificos.dadosSolicitacao.origensDisponiveis[indiceOrigemInicial];
        const mapeados = montarCamposMapeados(resultado, origemInicial);
        setResultadoConsulta(resultado);
        setIndiceOrigemSelecionada(indiceOrigemInicial);
        setIdsPecasSelecionadas(new Set(
          resultado.camposEspecificos.pecas.map(peca => `gdl-${peca.codPecaGdl ?? peca.idLocal}`),
        ));
        setIndicesEnvolvidosSelecionados(new Set(
          montarEnvolvidosRevisao(resultado)
            .filter(envolvido => envolvido.indice < 10)
            .map(envolvido => envolvido.indice),
        ));
        setCamposMapeados(mapeados);
        setCamposNaoPreenchidos(montarCamposNaoPreenchidos(mapeados));
        setPasso('revisao');
      } else {
        setErro(r.error || 'Erro ao consultar REP');
      }
    } catch (e: unknown) {
      setErro(getMensagemErro(e, 'Erro ao consultar REP'));
    } finally {
      setBuscando(false);
    }
  };

  const handleAplicar = async () => {
    if (!resultadoConsulta) return;
    setAplicando(true);
    try {
      const origemSelecionada = indiceOrigemSelecionada === null
        ? undefined
        : resultadoConsulta.camposEspecificos.dadosSolicitacao.origensDisponiveis[indiceOrigemSelecionada];
      const resultadoComOrigem = origemSelecionada ? {
        ...resultadoConsulta,
        camposGerais: {
          ...resultadoConsulta.camposGerais,
          tipo_solicitacao: origemSelecionada.tipo,
          numero_documento: origemSelecionada.numero,
          data_documento: origemSelecionada.dataDocumento ?? '',
        },
        ...(resultadoConsulta.metadadosIntegracaoGdl ? {
          metadadosIntegracaoGdl: {
            ...resultadoConsulta.metadadosIntegracaoGdl,
            origemSolicitacaoSelecionada: origemSelecionada,
          },
        } : {}),
      } : resultadoConsulta;
      const itensReconciliacao = montarItensReconciliacaoPecasB602(
        pecasB602,
        resultadoComOrigem.camposEspecificos.pecas,
      );
      const pecasImportadasSelecionadas = itensReconciliacao
        .filter(item => idsPecasSelecionadas.has(item.chave))
        .map(item => item.peca);
      const camposGeraisComEnvolvidos = Object.fromEntries(
        Object.entries(resultadoComOrigem.camposGerais)
          .filter(([campo]) => !campo.startsWith('b602_envolvidos_')),
      );
      montarEnvolvidosRevisao(resultadoComOrigem)
        .filter(envolvido => envolvido.indice < 10 && indicesEnvolvidosSelecionados.has(envolvido.indice))
        .forEach((envolvido, indice) => {
          camposGeraisComEnvolvidos[`b602_envolvidos_qualificacao_${indice}`] = envolvido.qualificacao;
          camposGeraisComEnvolvidos[`b602_envolvidos_${indice}`] = envolvido.nome;
        });

      await onAplicar({
        ...resultadoComOrigem,
        camposGerais: camposGeraisComEnvolvidos,
        camposEspecificos: {
          ...resultadoComOrigem.camposEspecificos,
          pecas: resultadoComOrigem.camposEspecificos.pecas.filter(peca => idsPecasSelecionadas.has(`gdl-${peca.codPecaGdl ?? peca.idLocal}`)),
        },
      }, modo, pecasImportadasSelecionadas);
      onOpenChange(false);
    } finally {
      setAplicando(false);
    }
  };

  const alternarSelecaoPeca = (idLocal: string) => {
    setIdsPecasSelecionadas(atuais => {
      const proximas = new Set(atuais)
      if (proximas.has(idLocal)) proximas.delete(idLocal)
      else proximas.add(idLocal)
      return proximas
    })
  }

  const handleClose = () => {
    setPasso('busca');
    setErro(null);
    onOpenChange(false);
  };

  const handleSelecionarOrigem = (valor: string) => {
    if (!resultadoConsulta) return
    const indice = Number(valor)
    const origem = resultadoConsulta.camposEspecificos.dadosSolicitacao.origensDisponiveis[indice]
    if (!Number.isInteger(indice) || !origem) return

    const campos = montarCamposMapeados(resultadoConsulta, origem)
    setIndiceOrigemSelecionada(indice)
    setCamposMapeados(campos)
    setCamposNaoPreenchidos(montarCamposNaoPreenchidos(campos))
  }

  const alternarSelecaoEnvolvido = (indice: number) => {
    setIndicesEnvolvidosSelecionados(atuais => {
      const proximos = new Set(atuais)
      if (proximos.has(indice)) proximos.delete(indice)
      else proximos.add(indice)
      return proximos
    })
  }

  const ambienteLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';
  const itensReconciliacao = resultadoConsulta
    ? montarItensReconciliacaoPecasB602(pecasB602, resultadoConsulta.camposEspecificos.pecas)
    : [];
  const todasPecasSelecionadas = itensReconciliacao.length > 0
    && itensReconciliacao.every(item => idsPecasSelecionadas.has(item.chave));
  const alternarTodasSelecoesPecas = () => {
    setIdsPecasSelecionadas(todasPecasSelecionadas
      ? new Set()
      : new Set(itensReconciliacao.map(item => item.chave)));
  };
  const avisosPreenchimentoManual = resultadoConsulta?.avisos.filter(aviso => aviso.codigo === 'ENVOLVIDOS_NAO_RETORNADOS') ?? [];
  const avisosDestacados = resultadoConsulta?.avisos.filter(aviso => (
    aviso.codigo !== 'ENVOLVIDOS_NAO_RETORNADOS'
    && aviso.codigo !== 'FUNCIONAMENTO_NAO_TESTADO_PADRAO'
  )) ?? [];
  const origensDisponiveis = resultadoConsulta?.camposEspecificos.dadosSolicitacao.origensDisponiveis ?? [];
  const origensCandidatas = obterOrigensCandidatas(origensDisponiveis);
  const haOrigemPreferencial = origensDisponiveis.some(origemPertenceFamiliaPreferencial);
  const exigeSelecaoOrigem = origensDisponiveis.length > 0 && !haOrigemPreferencial;
  const envolvidosRevisao = montarEnvolvidosRevisao(resultadoConsulta);
  const obterCamposDoGrupo = (campos: string[]): CampoMapeado[] => (
    camposMapeados.filter(campo => campos.includes(campo.campo))
  );
  const camposIdentificacao = obterCamposDoGrupo(['numero', 'data_requisicao']);
  const camposSolicitacao = obterCamposDoGrupo(['tipo_solicitacao', 'numero_documento', 'data_documento']);
  const camposSolicitanteLocal = obterCamposDoGrupo([
    'b602_solicitante_nome', 'autoridade_solicitante', 'b602_local_cidade', 'local_fato', 'latitude', 'longitude',
  ]);
  const camposInvestigacao = obterCamposDoGrupo(['b602_numero_bo', 'b602_numero_ip']);
  const camposJaAgrupados = new Set([
    ...camposIdentificacao,
    ...camposSolicitacao,
    ...camposSolicitanteLocal,
    ...camposInvestigacao,
  ].map(campo => campo.campo));
  const camposAdicionais = camposMapeados.filter(campo => (
    !camposJaAgrupados.has(campo.campo) && campo.campo !== 'envolvidos' && campo.campo !== 'observacoes'
  ));
  const quesitoAberto = camposMapeados.find(campo => campo.campo === 'observacoes');
  const etapasConsulta = [
    { label: 'Busca', concluida: passo === 'revisao' && Boolean(resultadoConsulta) },
    { label: 'Identificação', concluida: camposIdentificacao.length > 0 },
    {
      label: 'Solicitação',
      concluida: camposSolicitacao.length > 0 || camposSolicitanteLocal.length > 0,
    },
    {
      label: 'Investigação',
      concluida: camposInvestigacao.length > 0 || envolvidosRevisao.length > 0,
    },
    { label: 'Peças', concluida: itensReconciliacao.length > 0 },
  ];

  const getPreTesteMensagem = (): string => {
    if (!preTeste) return 'Verificando conexão...';
    if (preTeste.ok) {
      return `GDL acessível na rede \u2014 ${preTeste.ambiente} (${preTeste.latencia}ms)`;
    }
    const erroRede = preTeste.erro?.toUpperCase() || '';
    if (erroRede.includes('ERR_NAME_NOT_RESOLVED') || erroRede.includes('ENOTFOUND')) {
      return 'Não foi possível localizar o endereço do GDL. Verifique a conexão com a VPN institucional e tente novamente.';
    }
    if (erroRede.includes('TIMEOUT') || erroRede.includes('ECONNREFUSED')) {
      return `Sem conexão com o servidor GDL (${ambienteLabel}). Verifique a VPN.`;
    }
    return preTeste.erro || `Erro de conexão com o GDL (${ambienteLabel}).`;
  };

  const selectTriggerAnoValue = anoManual ? 'manual' : (anoRep || undefined);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex w-11/12 max-w-6xl flex-col max-h-[88vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Consultar GDL
            <Badge variant={ambiente === 'producao' ? 'destructive' : 'secondary'}>{ambienteLabel}</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleTestarConexao}
              disabled={preTesteTestando}
              title="Testar conexão"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${preTesteTestando ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex shrink-0 items-center gap-2 overflow-x-auto pb-1" aria-label="Progresso da consulta GDL">
          {etapasConsulta.map((etapa, indice) => (
            <React.Fragment key={etapa.label}>
              {indice > 0 && (
                <Separator className={etapasConsulta[indice - 1].concluida && etapa.concluida ? 'h-px min-w-4 w-auto flex-1 bg-green-600/50' : 'h-px min-w-4 w-auto flex-1'} />
              )}
              <div className={`flex shrink-0 items-center gap-1 text-sm ${
                etapa.concluida
                  ? 'font-semibold text-green-700 dark:text-green-400'
                  : passo === 'busca' && indice === 0
                    ? 'font-semibold text-primary'
                    : 'text-muted-foreground'
              }`}>
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                  etapa.concluida ? 'border-green-600 bg-green-600 text-white' : 'border-current'
                }`}>
                  {etapa.concluida ? <CheckCircle className="h-3.5 w-3.5" /> : indice + 1}
                </span>
                {etapa.label}
              </div>
            </React.Fragment>
          ))}
        </div>

        {passo === 'busca' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-1">
              {preTeste && (
                <Alert variant={preTeste.ok ? 'default' : 'destructive'}>
                  <div className="flex items-start gap-2">
                    {preTeste.ok ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5" />
                    )}
                    <AlertDescription className="space-y-1">
                      <p>{getPreTesteMensagem()}</p>
                      {!preTeste.ok && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestarConexao}
                          disabled={preTesteTestando}
                          className="mt-2"
                        >
                          Testar novamente
                        </Button>
                      )}
                      {preTeste.rede && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Badge variant={preTeste.rede.sucesso ? 'secondary' : 'destructive'} className="text-xs">
                            Rede: {preTeste.rede.sucesso ? 'OK' : 'Falha'}
                          </Badge>
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {!preTeste && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando conexão com o GDL...
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gdl-numero-rep">Nº da REP</Label>
                  <Input
                    id="gdl-numero-rep"
                    value={formatarNumeroRep(numeroRep)}
                    onChange={e => setNumeroRep(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => { if (e.key === 'Enter') handleBuscar(); }}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gdl-ano-rep">Ano</Label>
                  <Select
                    value={selectTriggerAnoValue}
                    onValueChange={handleAnoChange}
                  >
                    <SelectTrigger id="gdl-ano-rep">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="!max-h-[150px]">
                      {ANOS_OPCOES.map(ano => (
                        <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                      ))}
                      <SelectItem value="manual">Digitar manualmente...</SelectItem>
                    </SelectContent>
                  </Select>
                  {anoManual && (
                    <div className="pt-2">
                      <Input
                        value={anoManualValor}
                        onChange={e => handleAnoManualChange(e.target.value)}
                        placeholder="Ex: 2024"
                        maxLength={4}
                        inputMode="numeric"
                        className={anoManualErro ? 'border-destructive' : ''}
                      />
                      {anoManualErro && (
                        <p className="text-xs text-destructive mt-1">{anoManualErro}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {erro && (
                <Alert variant="destructive">
                  <AlertDescription className="space-y-2">
                    <p>
                      {avisoNaturezaEmDesenvolvimento ? (
                        <>
                          {avisoNaturezaEmDesenvolvimento.prefixo}
                          <strong className="font-semibold">
                            {avisoNaturezaEmDesenvolvimento.naturezaExame}
                          </strong>
                          {avisoNaturezaEmDesenvolvimento.sufixo}
                        </>
                      ) : (
                        erro
                      )}
                    </p>
                    {erro.includes('Credenciais não configuradas') && (
                      <Button variant="outline" size="sm" onClick={onConfigurarCredenciais}>
                        Configurar credenciais
                      </Button>
                    )}
                    {erro.includes('ainda está em desenvolvimento no laWdo') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          void navigator.clipboard.writeText(EMAIL_SUPORTE_LAWDO);
                          toast.success(`E-mail copiado: ${EMAIL_SUPORTE_LAWDO}`);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                        Dúvidas/Sugestões
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator className="shrink-0" />

            <div className="flex justify-end gap-3 shrink-0 pt-3">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleBuscar}
                disabled={!ambienteCarregado || !numeroRep.trim() || !anoRep.trim() || buscando}
                className="gap-2"
              >
                {buscando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {buscando ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </>
        )}

        {passo === 'revisao' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 px-1">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <ListChecks className="h-4 w-4" />
                  Campos que serão preenchidos
                </Label>

                <div className="space-y-2">
                  <Card className="shadow-none sm:flex sm:items-center">
                    <CardHeader className="p-3 pb-2 sm:basis-1/4 sm:pb-3">
                      <CardTitle className="flex items-center gap-1.5 text-sm">
                        <FileText className="h-4 w-4 text-primary" />
                        Identificação da REP
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:flex-1 sm:pt-3">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
                        {camposIdentificacao.map(campo => (
                          <div key={campo.campo} className="min-w-0">
                            <dt className="text-xs font-medium text-muted-foreground">{campo.label}</dt>
                            <dd className="break-words text-sm font-medium leading-5">{campo.valor}</dd>
                          </div>
                        ))}
                        <div className="min-w-0">
                          <dt className="text-xs font-medium text-muted-foreground">Tipo de exame</dt>
                          <dd className="mt-0.5 break-words text-sm font-medium leading-5">
                            {resultadoConsulta?.naturezaExameGdl ?? resultadoConsulta?.codigoExame}
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 items-stretch gap-2 xl:grid-cols-[3fr_2fr]">
                    <Card className="h-full shadow-none">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="flex items-center gap-1.5 text-sm">
                          <ClipboardList className="h-4 w-4 text-primary" />
                          Solicitação
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 p-3 pt-0">
                        {origensCandidatas.length > 0 && (
                          <div className="space-y-1">
                            <Label htmlFor="gdl-origem-solicitacao" className="text-xs">Origem utilizada no formulário</Label>
                            <Select
                              value={indiceOrigemSelecionada === null ? undefined : String(indiceOrigemSelecionada)}
                              onValueChange={handleSelecionarOrigem}
                            >
                              <SelectTrigger
                                id="gdl-origem-solicitacao"
                                aria-describedby={exigeSelecaoOrigem ? 'gdl-origem-ajuda' : undefined}
                              className="h-9"
                              >
                                <SelectValue placeholder="Selecione a origem..." />
                              </SelectTrigger>
                              <SelectContent>
                                {origensCandidatas.map(({ indice, origem }) => (
                                  <SelectItem key={indice} value={String(indice)} className="whitespace-normal py-2 leading-4">
                                    {formatarOpcaoOrigem(origem)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {exigeSelecaoOrigem && (
                              <p id="gdl-origem-ajuda" className="text-xs text-amber-700 dark:text-amber-400">
                                O GDL não retornou BO, IP ou Ofício. Escolha uma origem para continuar.
                              </p>
                            )}
                          </div>
                        )}
                        <ListaCamposRevisao
                          campos={[
                            ...camposSolicitacao,
                            ...camposSolicitanteLocal,
                            ...camposAdicionais,
                          ]}
                          className="sm:grid-cols-3"
                        />
                        {quesitoAberto && (
                          <div className="border-t pt-2">
                            <p className="text-xs font-medium text-muted-foreground">Quesito Aberto</p>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5">{quesitoAberto.valor}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {(camposInvestigacao.length > 0 || envolvidosRevisao.length > 0) && (
                      <Card className="h-full shadow-none">
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="flex items-center gap-1.5 text-sm">
                            <ListChecks className="h-4 w-4 text-primary" />
                            Investigação
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <ListaCamposRevisao campos={camposInvestigacao} />
                          {envolvidosRevisao.length > 0 && (
                            <div className={camposInvestigacao.length > 0 ? 'mt-3 border-t pt-3' : undefined}>
                              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <UsersRound className="h-4 w-4 text-primary" />
                                Envolvidos ({envolvidosRevisao.length})
                              </p>
                              <ol className="space-y-1.5">
                                {envolvidosRevisao.map((envolvido, indice) => (
                                  <li key={`${envolvido.nome}-${envolvido.indice}`} className="grid grid-cols-[auto_1.25rem_7rem_minmax(0,1fr)] items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm">
                                    <Checkbox
                                      checked={indicesEnvolvidosSelecionados.has(envolvido.indice)}
                                      onCheckedChange={() => alternarSelecaoEnvolvido(envolvido.indice)}
                                      disabled={envolvido.indice >= 10}
                                      aria-label={`Preencher ${envolvido.nome} automaticamente`}
                                    />
                                    <span className="text-muted-foreground">{indice + 1}.</span>
                                    {envolvido.qualificacao ? (
                                      <Badge variant="secondary" className="w-28 justify-center text-center">{envolvido.qualificacao}</Badge>
                                    ) : (
                                      <span className="w-28" aria-hidden />
                                    )}
                                    <span className="min-w-0 flex-1 break-words font-medium">{envolvido.nome}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                </div>
              </div>

              {!!avisosDestacados.length && (
                <Alert variant="default" className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    {avisosDestacados.map(aviso => <p key={`${aviso.codigo}-${aviso.mensagem}`}>{aviso.mensagem}</p>)}
                  </AlertDescription>
                </Alert>
              )}

              {!!itensReconciliacao.length && (
                <Card className="shadow-none">
                  <CardHeader className="flex-row items-center justify-between gap-3 p-3 pb-2">
                    <CardTitle className="text-sm">Peças Encontradas ({itensReconciliacao.length})</CardTitle>
                    <Button variant="outline" size="sm" onClick={alternarTodasSelecoesPecas}>
                      {todasPecasSelecionadas ? <Square className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                      {todasPecasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0">
                    {itensReconciliacao.map(({ chave, peca }, indice) => (
                      <label key={chave} className="block cursor-pointer rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted/50">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={idsPecasSelecionadas.has(chave)}
                            onCheckedChange={() => alternarSelecaoPeca(chave)}
                            className="shrink-0 self-center"
                          />
                          <dl className="grid min-w-0 flex-1 grid-cols-[0.35fr_1.1fr_1.8fr_1fr_1.1fr_1.1fr] gap-x-3 text-sm">
                            <div className="flex min-w-0 items-center justify-center"><dt className="sr-only">Ordem da peça</dt><dd>{indice + 1}</dd></div>
                            <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Tipo do Item</dt><dd className="truncate font-medium" title={peca.tipoPeca || 'Não informado'}>{peca.tipoPeca || 'Não informado'}</dd></div>
                            <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Identificação</dt><dd className="truncate" title={peca.comuns.identificacao || 'Não informada'}>{peca.comuns.identificacao || 'Não informada'}</dd></div>
                            <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Quantidade</dt><dd className="truncate">{peca.comuns.quantidade} {peca.comuns.unidadeMedida || 'unidade(s)'}</dd></div>
                            <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Lacre Entrada</dt><dd className="truncate" title={peca.comuns.lacreEntrada || 'Não informado'}>{peca.comuns.lacreEntrada || 'Não informado'}</dd></div>
                            <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Lacre Saída</dt><dd className="truncate" title={peca.comuns.lacreSaida || 'Não informado'}>{peca.comuns.lacreSaida || 'Não informado'}</dd></div>
                          </dl>
                        </div>
                      </label>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-1">
                <Label className="text-sm font-medium">Preenchimento manual necessário</Label>
                <div className="flex flex-wrap gap-1">
                  {camposNaoPreenchidos.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>

              {!!avisosPreenchimentoManual.length && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {avisosPreenchimentoManual.map(aviso => (
                    <p key={`${aviso.codigo}-${aviso.mensagem}`}>{aviso.mensagem}</p>
                  ))}
                </div>
              )}

              {temDadosExistentes && (
                <Alert variant="default" className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    <p className="font-medium mb-1">O formulário já possui dados preenchidos.</p>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="modo-gdl"
                          checked={modo === 'mesclar'}
                          onChange={() => setModo('mesclar')}
                          className="text-primary"
                        />
                        <span className="text-sm">Mesclar (só preencher vazios)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="modo-gdl"
                          checked={modo === 'substituir'}
                          onChange={() => setModo('substituir')}
                          className="text-primary"
                        />
                        <span className="text-sm">Substituir dados do GDL</span>
                      </label>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator className="shrink-0" />

            <div className="flex justify-between shrink-0 pt-3">
              <Button variant="outline" onClick={() => setPasso('busca')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button
                onClick={handleAplicar}
                disabled={aplicando || (exigeSelecaoOrigem && indiceOrigemSelecionada === null)}
                className="gap-2"
              >
                {temDadosExistentes ? 'Aplicar ao Formulário' : 'Preencher formulário'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
