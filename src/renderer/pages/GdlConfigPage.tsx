import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

const URL_HOMOLOGACAO = 'iishml01.pr.gov.br';
const URL_PRODUCAO = 'www.gdl.sesp.parana';
const ANO_ATUAL = new Date().getFullYear().toString();

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

export const GdlConfigPage: React.FC = () => {
  const [ambiente, setAmbiente] = useState('homologacao');
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
  const [validandoCredenciais, setValidandoCredenciais] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [sucessoValidacao, setSucessoValidacao] = useState<string | null>(null);

  const carregarCredenciaisAmbiente = useCallback(async (amb: string) => {
    try {
      const [rLogin, rSenha, rCpf] = await Promise.all([
        window.ipcAPI.configuracao.obter(`gdl_login_${amb}`),
        window.ipcAPI.configuracao.obter(`gdl_senha_${amb}`),
        window.ipcAPI.configuracao.obter(`gdl_cpf_usuario_${amb}`),
      ]);
      setLogin(rLogin.success && rLogin.data ? rLogin.data : '');
      setSenha(rSenha.success && rSenha.data ? rSenha.data : '');
      setCpfUsuario(rCpf.success && rCpf.data ? rCpf.data : '');
    } catch {
      // silencioso
    }
  }, []);

  const carregarConfigs = useCallback(async () => {
    try {
      const rAmbiente = await window.ipcAPI.configuracao.obter('gdl_ambiente');
      const amb = (rAmbiente.success && rAmbiente.data) ? rAmbiente.data : 'homologacao';
      setAmbiente(amb);
      await carregarCredenciaisAmbiente(amb);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => { carregarConfigs(); }, []);

  useEffect(() => {
    carregarCredenciaisAmbiente(ambiente);
  }, [ambiente]);

  useEffect(() => {
    window.ipcAPI.gdl.obterValidacaoSessao(ambiente)
      .then((r: { success: boolean; data?: unknown }) => {
        if (r.success && r.data) {
          setValidacaoSessao(r.data as ValidacaoSessaoGdl);
        } else {
          setValidacaoSessao(null);
        }
      })
      .catch(() => setValidacaoSessao(null));
  }, [ambiente]);

  const formatarCPF = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };

  const handleSalvar = async () => {
    setErro(null);
    setSalvarErro(null);

    const ambLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';

    if (!login.trim() || !senha.trim()) {
      const faltantes: string[] = [];
      if (!login.trim()) faltantes.push('login');
      if (!senha.trim()) faltantes.push('senha');
      setSalvarErro(`Preencha ${faltantes.join(' e ')} de ${ambLabel} para consultas.`);
      return;
    }

    setSalvando(true);
    try {
      await Promise.all([
        window.ipcAPI.configuracao.salvar('gdl_ambiente', ambiente, 'texto', 'Ambiente da API GDL'),
        window.ipcAPI.configuracao.salvar(`gdl_login_${ambiente}`, login, 'texto', `Login GDL (${ambLabel})`),
        window.ipcAPI.configuracao.salvar(`gdl_senha_${ambiente}`, senha, 'senha', `Senha GDL (${ambLabel})`),
        window.ipcAPI.configuracao.salvar(`gdl_cpf_usuario_${ambiente}`, cpfUsuario.replace(/\D/g, ''), 'texto', `CPF usuário GDL (${ambLabel})`),
      ]);
      const rValidacao = await window.ipcAPI.gdl.limparValidacaoSessao(ambiente);
      if (rValidacao.success && rValidacao.data) {
        setValidacaoSessao(rValidacao.data as ValidacaoSessaoGdl);
      }
      toast.success(`Credenciais de ${ambLabel} salvas com sucesso!`);
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  };

  const handleTestar = async () => {
    setErro(null);
    setSalvarErro(null);
    setDiagnostico(null);
    setTestando(true);
    try {
      const r = await window.ipcAPI.gdl.testarConexao(ambiente);
      if (r.success && r.data) {
        setDiagnostico(r.data);
      } else {
        setErro(r.error || 'Erro ao testar conexão');
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao testar conexão');
    } finally {
      setTestando(false);
    }
  };

  const abrirModalValidacao = () => {
    setErroValidacao(null);
    setSucessoValidacao(null);
    setNumeroRepValidacao('');
    setAnoRepValidacao(ANO_ATUAL);
    setModalValidacaoOpen(true);
  };

  const handleValidarCredenciais = async () => {
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

      if (r.success && r.data) {
        const rSessao = await window.ipcAPI.gdl.obterValidacaoSessao(ambiente);
        if (rSessao.success && rSessao.data) {
          setValidacaoSessao(rSessao.data as ValidacaoSessaoGdl);
        }
        setSucessoValidacao(`Credenciais validadas com sucesso usando a REP ${numeroRepValidacao}/${anoRepValidacao}.`);
      } else {
        setErroValidacao(r.error || 'Não foi possível validar as credenciais no GDL.');
      }
    } catch (e: any) {
      setErroValidacao(e.message || 'Erro ao validar credenciais no GDL.');
    } finally {
      setValidandoCredenciais(false);
    }
  };

  const isHomologacao = ambiente === 'homologacao';
  const ambienteLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';
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
          <Badge variant={ambiente === 'producao' ? 'default' : 'secondary'} className="text-xs">
            Ambiente em uso: {ambienteLabel}
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

      <Card>
        <CardHeader>
          <CardTitle>Conexão</CardTitle>
          <CardDescription>
            Credenciais de acesso à API REST do GDL. A senha é armazenada criptografada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ---------- Seleção de ambiente com cards ---------- */}
          <div className="space-y-3">
            <Label>Ambiente</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card Homologação */}
              <button
                type="button"
                onClick={() => setAmbiente('homologacao')}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  isHomologacao
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-muted-foreground/20 hover:border-muted-foreground/40 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className={`h-5 w-5 ${isHomologacao ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`font-semibold text-sm ${isHomologacao ? 'text-primary' : ''}`}>
                    Homologação
                  </span>
                  {isHomologacao && (
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

              {/* Card Produção */}
              <button
                type="button"
                onClick={() => setAmbiente('producao')}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  !isHomologacao
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-muted-foreground/20 hover:border-muted-foreground/40 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className={`h-5 w-5 ${!isHomologacao ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`font-semibold text-sm ${!isHomologacao ? 'text-primary' : ''}`}>
                    Produção
                  </span>
                  {!isHomologacao && (
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
                onChange={e => setLogin(e.target.value)}
                placeholder="Seu usuário do GDL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gdl-senha">Senha</Label>
              <div className="relative">
                <Input
                  id="gdl-senha"
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
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
              onChange={e => setCpfUsuario(formatarCPF(e.target.value))}
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
            <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
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
                        {diagnostico.erro || 'Ainda não executado.'}
                      </p>
                    )}

                    {(diagnostico.rede?.erro || diagnostico.erro) && (
                      <p className="text-sm text-red-600">
                        {diagnostico.rede?.erro || diagnostico.erro}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Execute o teste para verificar conectividade com o ambiente selecionado.
                  </p>
                )}

                <Button variant="outline" onClick={handleTestar} disabled={testando} className="gap-2 w-full">
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
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Status da sessão</span>
                    <Badge variant={validacaoSessao?.validado ? 'default' : 'secondary'} className="text-xs ml-auto">
                      {validacaoSessao?.validado ? 'Validada' : 'Pendente'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {validacaoSessao?.validado
                      ? `Credenciais validadas nesta sessão com a REP ${validacaoSessao.numeroRep}/${validacaoSessao.anoRep}.`
                      : 'A validação de credenciais acontece quando uma REP válida é consultada com sucesso no ambiente atual.'}
                  </p>
                  {validacaoSessao?.validado && (
                    <p className="text-xs text-muted-foreground">
                      Última validação: {formatarDataHora(validacaoSessao.dataHora)}
                    </p>
                  )}
                </div>

                <Button variant="outline" onClick={abrirModalValidacao} className="gap-2 w-full">
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
                  onChange={(e) => setNumeroRepValidacao(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validacao-ano-rep">Ano</Label>
                <Input
                  id="validacao-ano-rep"
                  value={anoRepValidacao}
                  onChange={(e) => setAnoRepValidacao(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="2026"
                  maxLength={4}
                />
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
              <Button onClick={handleValidarCredenciais} disabled={validandoCredenciais} className="gap-2">
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

export default GdlConfigPage;
