import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  Clock,
  Shield,
  FlaskConical,
  Building2,
  Globe,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

const URL_HOMOLOGACAO = 'iishml01.pr.gov.br';
const URL_PRODUCAO = 'www.gdl.sesp.parana';

interface TesteDiagnostico {
  sucesso: boolean;
  latencia: number;
  statusCode: number;
  autenticado: boolean;
  ambiente: string;
  endpointTestado: string;
  erro?: string;
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
  const [erro, setErro] = useState<string | null>(null);
  const [salvarErro, setSalvarErro] = useState<string | null>(null);

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

  const isHomologacao = ambiente === 'homologacao';

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          API GDL
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
            <Button variant="outline" onClick={handleTestar} disabled={testando} className="gap-2">
              <Wifi className="h-4 w-4" />
              {testando ? 'Testando...' : 'Testar Conexão'}
            </Button>
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

          {/* ---------- Diagnóstico ---------- */}
          {diagnostico && (
            <Card className={diagnostico.sucesso ? 'border-green-300 dark:border-green-800' : 'border-red-300 dark:border-red-800'}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  {diagnostico.sucesso ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {diagnostico.sucesso
                      ? `Conectado ao GDL — ${diagnostico.ambiente || 'Homologação'}`
                      : 'Falha na conexão'}
                  </span>
                  {diagnostico.ambiente && (
                    <Badge variant="secondary" className="text-xs ml-1">{diagnostico.ambiente}</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Latência:
                  </div>
                  <div>{diagnostico.latencia}ms</div>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Wifi className="h-3.5 w-3.5" />
                    Status HTTP:
                  </div>
                  <div>
                    {diagnostico.statusCode > 0 ? (
                      <Badge variant={diagnostico.statusCode < 400 ? 'secondary' : 'destructive'}>
                        {diagnostico.statusCode}
                      </Badge>
                    ) : (
                      <span className="text-red-600">—</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    Autenticação:
                  </div>
                  <div>
                    {diagnostico.autenticado ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">OK</Badge>
                    ) : (
                      <Badge variant="destructive">Falha</Badge>
                    )}
                  </div>

                  {diagnostico.endpointTestado && (
                    <>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" />
                        Endpoint:
                      </div>
                      <div className="text-xs font-mono text-muted-foreground truncate" title={diagnostico.endpointTestado}>
                        {diagnostico.endpointTestado.replace(diagnostico.endpointTestado.split('/api')[0], '')}
                      </div>
                    </>
                  )}
                </div>
                {diagnostico.erro && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-red-600 font-medium">Detalhes do erro:</p>
                    <p className="text-sm text-red-600">{diagnostico.erro}</p>
                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                      <p>Verifique:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>VPN da Polícia Científica está ativa?</li>
                        <li>Ambiente correto selecionado? (Homologação / Produção)</li>
                        <li>Login e senha válidos?</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GdlConfigPage;
