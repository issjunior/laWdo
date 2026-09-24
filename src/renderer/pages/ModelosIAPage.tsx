import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/forms/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  KeyRound,
  BookOpen,
  Image,
  Info,
  Square,
} from 'lucide-react';
import {
  CONFIGURACAO_IMAGEM_IA_PADRAO,
  CONFIGURACAO_PRIVACIDADE_IA_PADRAO,
  configuracaoImagemIaValida,
  configuracaoPrivacidadeIaValida,
  deveMascararConteudoIa,
  PERFIL_RESPOSTA_IA_PADRAO,
  type ConfiguracaoPrivacidadeIa,
  type ConfiguracaoImagemIa,
  type PerfilRespostaIa,
} from '@shared/types/ia.types';
import { listarModelosIa } from '@shared/catalogos/modelos-ia.catalogo';

const iaConfigSchema = z.object({
  provedor: z.enum(['groq', 'gemini']),
  apiKeyGroq: z.string().optional(),
  apiKeyGemini: z.string().optional(),
  modeloGroq: z.string(),
  modeloGemini: z.string(),
});

type IAConfigForm = z.infer<typeof iaConfigSchema>;

const GROQ_MODEL_OPTIONS = listarModelosIa('groq').map(modelo => ({ value: modelo.id, label: modelo.rotulo }));
const GEMINI_MODEL_OPTIONS = listarModelosIa('gemini').map(modelo => ({ value: modelo.id, label: modelo.rotulo }));

const OPCOES_QUALIDADE_IMAGEM = [
  {
    valor: 'original',
    rotulo: 'Original',
    detalhe: 'Arquivo sem redução',
  },
  {
    valor: 'alta',
    rotulo: 'Redução leve',
    detalhe: 'Até 1536 px',
  },
  {
    valor: 'equilibrada',
    rotulo: 'Equilibrada',
    detalhe: 'Até 768 px',
  },
  {
    valor: 'economica',
    rotulo: 'Econômica',
    detalhe: 'Até 512 px',
  },
] as const;

const getMensagemErro = (erro: unknown): string =>
  erro instanceof Error ? erro.message : 'Erro desconhecido';

const formatarTempoTeste = (segundos: number): string => {
  const minutos = Math.floor(segundos / 60);
  return `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
};

interface MensagemTesteConexaoIa {
  titulo: string;
  mensagem: string;
}

const obterMensagemErroConexaoIa = (erro: string | undefined, provedor: string): MensagemTesteConexaoIa => {
  const codigo = (erro || '').split(':')[0];
  const mensagens: Record<string, MensagemTesteConexaoIa> = {
    CONFIGURACAO_AUSENTE: {
      titulo: 'Configuração incompleta',
      mensagem: 'Selecione o provedor e o modelo e informe uma chave de API antes de testar.',
    },
    ENTRADA_INVALIDA: {
      titulo: 'Dados inválidos',
      mensagem: 'Os dados do teste não puderam ser validados. Confira o provedor, o modelo e a chave de API.',
    },
    NAO_AUTORIZADO: {
      titulo: 'Chave recusada',
      mensagem: `O ${provedor} recusou a autenticação. Verifique se a chave está completa, ativa, pertence a esse provedor e tem acesso ao modelo selecionado.`,
    },
    MODELO_INDISPONIVEL: {
      titulo: 'Modelo não disponível',
      mensagem: `O ${provedor} não disponibilizou o modelo selecionado para esta chave. Escolha outro modelo ou confira as permissões da sua conta.`,
    },
    SALDO_INSUFICIENTE: {
      titulo: 'Créditos insuficientes',
      mensagem: `A conta do ${provedor} não possui créditos ou faturamento disponível para concluir o teste. Confira o plano e a cobrança no provedor.`,
    },
    LIMITE_REQUISICOES: {
      titulo: 'Limite de uso atingido',
      mensagem: `O ${provedor} bloqueou temporariamente novas solicitações por limite de uso ou frequência. Aguarde e tente novamente ou confira a cota da conta.`,
    },
    DNS_INDISPONIVEL: {
      titulo: 'Endereço do provedor não encontrado',
      mensagem: `O computador não conseguiu localizar o servidor do ${provedor}. Verifique a internet e as configurações de DNS, VPN ou proxy.`,
    },
    REDE_INDISPONIVEL: {
      titulo: 'Rede indisponível',
      mensagem: `O computador está sem rota até o ${provedor}. Confira a conexão com a internet, a VPN e as regras da rede local.`,
    },
    CONEXAO_RECUSADA: {
      titulo: 'Conexão recusada',
      mensagem: `A conexão com o ${provedor} foi recusada. Um firewall, proxy, antivírus ou bloqueio da rede pode estar impedindo o acesso.`,
    },
    CONEXAO_INTERROMPIDA: {
      titulo: 'Conexão interrompida',
      mensagem: `A comunicação com o ${provedor} foi encerrada antes da resposta. Verifique a estabilidade da internet, VPN, proxy ou firewall e tente novamente.`,
    },
    CERTIFICADO_TLS_INVALIDO: {
      titulo: 'Conexão segura bloqueada',
      mensagem: `Não foi possível validar o certificado de segurança do ${provedor}. Confira a data do computador e se proxy, antivírus ou rede corporativa inspeciona conexões HTTPS.`,
    },
    SEM_CONEXAO: {
      titulo: 'Não foi possível acessar o provedor',
      mensagem: `O laWdo não conseguiu iniciar a comunicação com o ${provedor}. Verifique a internet e possíveis bloqueios de proxy, VPN, firewall ou antivírus.`,
    },
    TIMEOUT: {
      titulo: 'Tempo de resposta esgotado',
      mensagem: `O ${provedor} não respondeu dentro do prazo. A conexão pode estar lenta ou instável, ou o serviço pode estar sobrecarregado. Tente novamente.`,
    },
    SOLICITACAO_RECUSADA: {
      titulo: 'Solicitação recusada',
      mensagem: `O ${provedor} considerou a solicitação de teste inválida. Confira a chave e o modelo; se o problema persistir, tente outro modelo.`,
    },
    RESPOSTA_INVALIDA: {
      titulo: 'Resposta inválida',
      mensagem: `O ${provedor} respondeu, mas o conteúdo não pôde ser reconhecido. Tente novamente; se persistir, escolha outro modelo.`,
    },
    PROVEDOR_INDISPONIVEL: {
      titulo: 'Serviço do provedor indisponível',
      mensagem: `O ${provedor} respondeu com uma falha temporária. Aguarde alguns instantes e tente novamente.`,
    },
    OPERACAO_EM_ANDAMENTO: {
      titulo: 'Teste já em andamento',
      mensagem: 'Já existe um teste de conexão em execução. Aguarde a conclusão ou cancele-o antes de tentar novamente.',
    },
  };
  return mensagens[codigo] || {
    titulo: 'Falha não identificada',
    mensagem: `Não foi possível validar a conexão com o ${provedor}. Tente novamente e, se o problema persistir, consulte os logs do aplicativo.`,
  };
};

export const ModelosIAPage: React.FC = () => {
  const [mostrarChave, setMostrarChave] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error' | 'cancelado';
    title: string;
    message: string;
  } | null>(null);
  const [tempoTesteSegundos, setTempoTesteSegundos] = useState(0);
  const [perfil, setPerfil] = useState<PerfilRespostaIa>(PERFIL_RESPOSTA_IA_PADRAO);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoPrivacidade, setSalvandoPrivacidade] = useState(false);
  const [privacidade, setPrivacidade] = useState<ConfiguracaoPrivacidadeIa>(CONFIGURACAO_PRIVACIDADE_IA_PADRAO);
  const [configuracaoImagem, setConfiguracaoImagem] = useState<ConfiguracaoImagemIa>(CONFIGURACAO_IMAGEM_IA_PADRAO);
  const [salvandoConfiguracaoImagem, setSalvandoConfiguracaoImagem] = useState(false);
  const [configuracaoAberta, setConfiguracaoAberta] = useState(false);
  const [guiaChaveAberto, setGuiaChaveAberto] = useState(false);
  const [confirmacaoPrivacidadeAberta, setConfirmacaoPrivacidadeAberta] = useState(false);
  const operacaoTesteConexaoRef = useRef<string | null>(null);

  const form = useForm<IAConfigForm>({
    resolver: zodResolver(iaConfigSchema),
    defaultValues: {
      provedor: 'groq',
      apiKeyGroq: '',
      apiKeyGemini: '',
      modeloGroq: 'llama-3.3-70b-versatile',
      modeloGemini: 'gemini-2.5-flash',
    },
    mode: 'onBlur',
  });

  const provedor = form.watch('provedor');

  useEffect(() => {
    if (!testando) return undefined;
    setTempoTesteSegundos(0);
    const intervalo = window.setInterval(() => setTempoTesteSegundos(atual => atual + 1), 1_000);
    return () => window.clearInterval(intervalo);
  }, [testando]);

  const carregarConfig = useCallback(async () => {
    try {
      const rProvedor = await window.ipcAPI.configuracao.obter('provedor_ia');
      if (rProvedor.success && rProvedor.data) {
        form.setValue('provedor', rProvedor.data as 'groq' | 'gemini');
      }

      const rKeyGroq = await window.ipcAPI.configuracao.obter('api_key_groq');
      if (rKeyGroq.success && rKeyGroq.data) {
        form.setValue('apiKeyGroq', rKeyGroq.data);
      }

      const rKeyGemini = await window.ipcAPI.configuracao.obter('api_key_gemini');
      if (rKeyGemini.success && rKeyGemini.data) {
        form.setValue('apiKeyGemini', rKeyGemini.data);
      }

      const rModeloGroq = await window.ipcAPI.configuracao.obter('modelo_ia_padrao');
      if (rModeloGroq.success && rModeloGroq.data) {
        form.setValue('modeloGroq', rModeloGroq.data);
      }

      const rModeloGemini = await window.ipcAPI.configuracao.obter('modelo_gemini_padrao');
      if (rModeloGemini.success && rModeloGemini.data) {
        form.setValue('modeloGemini', rModeloGemini.data);
      }

      const rPerfil = await window.ipcAPI.ia.obterPerfil();
      if (rPerfil.success && rPerfil.data) setPerfil(rPerfil.data);
      const rPrivacidade = await window.ipcAPI.configuracao.obter('privacidade_ia');
      if (rPrivacidade.success && typeof rPrivacidade.data === 'string') {
        try {
          const valor: unknown = JSON.parse(rPrivacidade.data);
          if (configuracaoPrivacidadeIaValida(valor)) setPrivacidade(valor);
        } catch {
          setPrivacidade(CONFIGURACAO_PRIVACIDADE_IA_PADRAO);
        }
      }
      const rConfiguracaoImagem = await window.ipcAPI.configuracao.obter('qualidade_imagem_ia');
      if (rConfiguracaoImagem.success && typeof rConfiguracaoImagem.data === 'string') {
        try {
          const valor: unknown = JSON.parse(rConfiguracaoImagem.data);
          if (configuracaoImagemIaValida(valor)) setConfiguracaoImagem(valor);
        } catch {
          setConfiguracaoImagem(CONFIGURACAO_IMAGEM_IA_PADRAO);
        }
      }
    } catch {
      // silencioso
    }
  }, [form]);

  useEffect(() => {
    carregarConfig();
  }, [carregarConfig]);

  const handleSalvar = form.handleSubmit(async (data) => {
    try {
      setSalvando(true);
      setError(null);
      setSuccess(null);

      const resultados = await Promise.all([
        window.ipcAPI.configuracao.salvar('provedor_ia', data.provedor, 'texto', 'Provedor de IA selecionado'),
        window.ipcAPI.configuracao.salvar('api_key_groq', data.apiKeyGroq || '', 'api_key', 'Chave de API Groq'),
        window.ipcAPI.configuracao.salvar('api_key_gemini', data.apiKeyGemini || '', 'api_key', 'Chave de API Gemini'),
        window.ipcAPI.configuracao.salvar('modelo_ia_padrao', data.modeloGroq, 'texto', 'Modelo padrão Groq'),
        window.ipcAPI.configuracao.salvar('modelo_gemini_padrao', data.modeloGemini, 'texto', 'Modelo padrão Gemini'),
        window.ipcAPI.configuracao.salvar('privacidade_ia', JSON.stringify(privacidade), 'json', 'Política de privacidade do conteúdo enviado à IA'),
      ]);

      const falha = resultados.find((r) => !r.success);
      if (falha) {
        setError(falha.error || 'Erro ao salvar configurações');
      } else {
        setSuccess('Configurações salvas com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      setError('Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  });

  const chaveAtual = provedor === 'gemini' ? form.watch('apiKeyGemini') : form.watch('apiKeyGroq');
  const provedorNome = provedor === 'gemini' ? 'Gemini' : 'Groq';

  const handleTestarConexao = async () => {
    const operationId = crypto.randomUUID();
    operacaoTesteConexaoRef.current = operationId;
    try {
      setTestando(true);
      setError(null);
      setTestResult(null);

      const valores = form.getValues();
      const apiKey = valores.provedor === 'gemini' ? valores.apiKeyGemini : valores.apiKeyGroq;
      const modelo = valores.provedor === 'gemini' ? valores.modeloGemini : valores.modeloGroq;
      const r = await window.ipcAPI.ia.testarConexao({
        operationId,
        provedor: valores.provedor,
        apiKey: apiKey?.trim() || '',
        modelo,
      });

      if (r.success) {
        const msg = `Conexão com a API ${provedorNome} estabelecida com sucesso!`;
        setTestResult({ status: 'success', title: 'Conexão validada', message: msg });
        window.ipcAPI.logInfo('IA', msg);
      } else if (r.error?.split(':')[0] === 'CANCELADO') {
        setTestResult({ status: 'cancelado', title: 'Teste cancelado', message: 'Teste de conexão cancelado.' });
      } else if (!r.success) {
        const erroApresentado = obterMensagemErroConexaoIa(r.error, provedorNome);
        setTestResult({ status: 'error', title: erroApresentado.titulo, message: erroApresentado.mensagem });
        window.ipcAPI.logError('IA', erroApresentado.mensagem, r.error);
      } else {
        const msg = `Ops! O ${provedorNome} retornou uma resposta inesperada. Confira se a sua chave está correta e tente novamente.`;
        setTestResult({ status: 'error', title: 'Resposta inesperada', message: msg });
        window.ipcAPI.logError('IA', msg, r.data);
      }
    } catch (_e: unknown) {
      const erroTecnico = getMensagemErro(_e);
      const msg = `O aplicativo não conseguiu concluir o teste com o ${provedorNome}. Verifique a conexão com a internet e tente novamente. Detalhe técnico: ${erroTecnico}`;
      setTestResult({ status: 'error', title: 'Falha ao executar o teste', message: msg });
      window.ipcAPI.logError('IA', msg, _e);
    } finally {
      if (operacaoTesteConexaoRef.current === operationId) {
        operacaoTesteConexaoRef.current = null;
        setTestando(false);
      }
    }
  };

  const cancelarTesteConexao = async () => {
    const operationId = operacaoTesteConexaoRef.current;
    if (!operationId) return;
    await window.ipcAPI.ia.cancelar(operationId);
  };

  const alterarAberturaConfiguracao = (aberta: boolean) => {
    setConfiguracaoAberta(aberta);
    if (!aberta && operacaoTesteConexaoRef.current) void cancelarTesteConexao();
  };

  const salvarPerfil = async () => {
    try {
      setSalvandoPerfil(true);
      setError(null);
      const resposta = await window.ipcAPI.ia.salvarPerfil(perfil);
      if (!resposta.success) {
        setError(resposta.error || 'Erro ao salvar preferências das respostas');
        return;
      }
      setSuccess('Preferências das respostas salvas com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const salvarPrivacidade = async () => {
    try {
      setSalvandoPrivacidade(true);
      setError(null);
      const resposta = await window.ipcAPI.configuracao.salvar(
        'privacidade_ia',
        JSON.stringify(privacidade),
        'json',
        'Política de privacidade do conteúdo enviado à IA',
      );
      if (!resposta.success) {
        setError(resposta.error || 'Não foi possível salvar a privacidade do conteúdo.');
        return;
      }
      setConfirmacaoPrivacidadeAberta(true);
    } catch (erro: unknown) {
      setError(getMensagemErro(erro));
    } finally {
      setSalvandoPrivacidade(false);
    }
  };

  const salvarConfiguracaoImagem = async () => {
    try {
      setSalvandoConfiguracaoImagem(true);
      setError(null);
      const resposta = await window.ipcAPI.configuracao.salvar(
        'qualidade_imagem_ia',
        JSON.stringify(configuracaoImagem),
        'json',
        'Qualidade da imagem enviada para descrição por IA',
      );
      if (!resposta.success) {
        setError(resposta.error || 'Não foi possível salvar a qualidade da imagem.');
        return;
      }
      setSuccess('Qualidade da imagem salva com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (erro: unknown) {
      setError(getMensagemErro(erro));
    } finally {
      setSalvandoConfiguracaoImagem(false);
    }
  };

  const modelOptions = provedor === 'gemini' ? GEMINI_MODEL_OPTIONS : GROQ_MODEL_OPTIONS;
  const modelFieldName = provedor === 'gemini' ? 'modeloGemini' as const : 'modeloGroq' as const;
  const apiKeyFieldName = provedor === 'gemini' ? 'apiKeyGemini' as const : 'apiKeyGroq' as const;
  const apiKeyPlaceholder = provedor === 'gemini' ? 'AIza...' : 'gsk_...';
  const mascaramentoAtivo = deveMascararConteudoIa(privacidade);
  const indiceQualidadeImagem = OPCOES_QUALIDADE_IMAGEM.findIndex(opcao => opcao.valor === configuracaoImagem.qualidade);
  const qualidadeImagemSelecionada = OPCOES_QUALIDADE_IMAGEM[indiceQualidadeImagem];

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* ── Título da Página ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Modelos de IA</h1>
      </div>

      {/* ── Alert: Recomendação ── */}
      <Alert className="border-primary/30 bg-primary/5 dark:bg-primary/10">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <AlertTitle className="font-semibold text-primary">
          Recomendação:
        </AlertTitle>
        <AlertDescription className="mt-1.5 text-sm text-foreground/80">
          Recomenda-se o uso do <strong>Google Gemini</strong> com o email institucional{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            @policiacientifica.pr.gov.br
          </code>
          . Ao utilizar uma conta institucional/Workspace, o Google{' '}
          <strong>não compartilha seus dados</strong> com terceiros e{' '}
          <strong>não utiliza as informações enviadas para treinamento</strong> de seus modelos de IA,
          garantindo a privacidade dos dados periciais.
        </AlertDescription>
      </Alert>

      {/* ── Alertas de Feedback (Erro / Sucesso) ── */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-400">
            {success}
          </AlertDescription>
        </Alert>
      )}
      <AlertDialog open={confirmacaoPrivacidadeAberta} onOpenChange={setConfirmacaoPrivacidadeAberta}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Privacidade do conteúdo salva</AlertDialogTitle>
            <AlertDialogDescription>
              A preferência de envio do conteúdo à IA foi atualizada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setConfirmacaoPrivacidadeAberta(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Form {...form}>
        <form onSubmit={handleSalvar} className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => setConfiguracaoAberta(true)}>
              <KeyRound className="h-5 w-5 text-primary" />
              <span className="text-left"><span className="block font-medium">Configurar provedor</span><span className="block text-xs font-normal text-muted-foreground">Modelo, chave e conexão</span></span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => setGuiaChaveAberto(true)}>
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-left"><span className="block font-medium">Obter chave de API</span><span className="block text-xs font-normal text-muted-foreground">Guia para Gemini e Groq</span></span>
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" />
                Privacidade do conteúdo enviado
              </CardTitle>
              <CardDescription>Escolha como o conteúdo do laudo será enviado à IA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-lg border p-4">
                  <div className="space-y-1">
                    <label htmlFor="conteudo-integral" className="text-sm font-medium">Enviar conteúdo integralmente</label>
                    <p className="text-xs text-muted-foreground">Inclui texto e imagens sem mascaramento, independentemente do modelo selecionado.</p>
                  </div>
                  <Checkbox id="conteudo-integral" checked={privacidade.enviarConteudoIntegral} onCheckedChange={checked => setPrivacidade({ versao: 1, enviarConteudoIntegral: checked === true })} />
                  <span aria-hidden="true" />
                </div>
                <Alert className={mascaramentoAtivo
                  ? 'border-green-600/30 bg-green-500/5 dark:border-green-500/40 dark:bg-green-500/10'
                  : 'border-amber-500/40 bg-amber-500/5 dark:border-amber-400/40 dark:bg-amber-500/10'}>
                  <ShieldCheck className={mascaramentoAtivo ? 'h-4 w-4 text-green-600 dark:text-green-400' : 'h-4 w-4 text-amber-600 dark:text-amber-400'} />
                  <AlertTitle>{mascaramentoAtivo ? 'Modo protegido ativo' : 'Modo conteúdo integral ativo'}</AlertTitle>
                  <AlertDescription>
                    {mascaramentoAtivo
                      ? 'Dados sensíveis são mascarados antes do envio.'
                      : 'O conteúdo é enviado sem mascaramento.'}
                  </AlertDescription>
                </Alert>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => void salvarPrivacidade()} disabled={salvandoPrivacidade}>
                  {salvandoPrivacidade ? 'Salvando...' : 'Salvar privacidade do conteúdo'}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye size={18} className="text-primary" />
                Imagem enviada para descrição
              </CardTitle>
              <CardDescription>Defina o equilíbrio entre fidelidade visual, consumo de tokens e uso de internet ao descrever figuras.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">Qualidade: {qualidadeImagemSelecionada.rotulo}</p>
                    <span className="text-xs text-muted-foreground">{qualidadeImagemSelecionada.detalhe}</span>
                  </div>
                  <Slider
                    aria-label="Qualidade da imagem enviada para descrição"
                    value={[indiceQualidadeImagem]}
                    min={0}
                    max={OPCOES_QUALIDADE_IMAGEM.length - 1}
                    step={1}
                    onValueChange={valores => {
                      const qualidade = OPCOES_QUALIDADE_IMAGEM[valores[0]]?.valor;
                      if (qualidade) setConfiguracaoImagem({ versao: 1, qualidade });
                    }}
                  />
                  <div className="grid grid-cols-4 text-[10px] text-muted-foreground">
                    {OPCOES_QUALIDADE_IMAGEM.map(opcao => <span key={opcao.valor} className="text-center first:text-left last:text-right">{opcao.rotulo}</span>)}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => void salvarConfiguracaoImagem()} disabled={salvandoConfiguracaoImagem}>
                    {salvandoConfiguracaoImagem ? 'Salvando...' : 'Salvar qualidade da imagem'}
                  </Button>
                </div>
              </div>
              <aside className="py-1" aria-label="Comparativo da proporção das imagens">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><Image className="h-4 w-4" /></div>
                  <div>
                    <h3 className="text-sm font-semibold">Proporção da foto enviada</h3>
                    <p className="text-xs text-muted-foreground">Da maior qualidade para a menor resolução.</p>
                  </div>
                </div>
                <div className="relative mt-5 h-44 overflow-hidden">
                  <div className="absolute left-1/2 h-full w-[22rem] -translate-x-1/2">
                    <div className="absolute left-3 top-3 h-32 w-56 rounded-lg border-2 border-primary/70 bg-gradient-to-br from-sky-300 via-slate-300 to-slate-700 shadow-sm dark:from-sky-800 dark:via-slate-600 dark:to-slate-950"><span className="absolute left-3 top-2 text-xs font-medium text-white">Original</span></div>
                    <div className="absolute left-24 top-8 h-28 w-48 rounded-lg border-2 border-primary/60 bg-gradient-to-br from-sky-300 via-slate-300 to-slate-700 shadow-sm dark:from-sky-800 dark:via-slate-600 dark:to-slate-950"><span className="absolute left-3 top-2 text-xs font-medium text-white">Leve</span></div>
                    <div className="absolute left-44 top-14 h-20 w-32 rounded-lg border-2 border-primary/45 bg-gradient-to-br from-sky-300 via-slate-300 to-slate-700 shadow-sm dark:from-sky-800 dark:via-slate-600 dark:to-slate-950"><span className="absolute left-3 top-2 text-[11px] font-medium text-white">Equilibrada</span></div>
                    <div className="absolute left-64 top-20 h-14 w-24 rounded-lg border-2 border-primary/30 bg-gradient-to-br from-sky-300 via-slate-300 to-slate-700 shadow-sm dark:from-sky-800 dark:via-slate-600 dark:to-slate-950"><span className="absolute left-2 top-1 text-[10px] font-medium text-white">Econômica</span></div>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Cada tela representa a escolha correspondente no slider.</p>
              </aside>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" />
                Preferências das respostas
              </CardTitle>
              <CardDescription>Oriente como a IA deve elaborar as respostas. Estas preferências não alteram o provedor, modelo ou chaves.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <TooltipProvider>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5"><FormLabel>Tom</FormLabel><Tooltip><TooltipTrigger asChild><button type="button" aria-label="Ajuda sobre os tons de resposta"><Info className="h-3.5 w-3.5 text-muted-foreground" /></button></TooltipTrigger><TooltipContent className="max-w-xs"><p><strong>Técnico-pericial:</strong> redação objetiva, impessoal e adequada a laudos.<br /><strong>Formal:</strong> linguagem mais solene e institucional.<br /><strong>Direto:</strong> frases curtas, simples e sem rodeios.</p></TooltipContent></Tooltip></div>
                  <Select value={perfil.tom} onValueChange={tom => setPerfil(atual => ({ ...atual, tom: tom as PerfilRespostaIa['tom'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tecnico_pericial">Técnico-pericial</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="direto">Direto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FormLabel>Detalhamento</FormLabel>
                  <Select value={perfil.detalhamento} onValueChange={detalhamento => setPerfil(atual => ({ ...atual, detalhamento: detalhamento as PerfilRespostaIa['detalhamento'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conciso">Conciso</SelectItem>
                      <SelectItem value="equilibrado">Equilibrado</SelectItem>
                      <SelectItem value="detalhado">Detalhado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5"><FormLabel>Temperatura</FormLabel><Tooltip><TooltipTrigger asChild><button type="button" aria-label="Ajuda sobre temperatura"><Info className="h-3.5 w-3.5 text-muted-foreground" /></button></TooltipTrigger><TooltipContent className="max-w-xs"><p>Controla a variação das respostas. Valores menores tornam a IA mais consistente; valores maiores permitem respostas mais variadas.</p></TooltipContent></Tooltip></div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={perfil.temperatura ?? 0.2}
                      onChange={evento => setPerfil(atual => ({ ...atual, temperatura: Number(evento.target.value) }))}
                      className="w-full accent-primary"
                      aria-label="Temperatura da resposta"
                    />
                    <span className="w-8 text-right text-sm tabular-nums">{(perfil.temperatura ?? 0.2).toFixed(1)}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5"><FormLabel>Instruções personalizadas</FormLabel><Tooltip><TooltipTrigger asChild><button type="button" aria-label="Ajuda sobre instruções personalizadas"><Info className="h-3.5 w-3.5 text-muted-foreground" /></button></TooltipTrigger><TooltipContent className="max-w-xs"><p>Use este campo para orientar respostas específicas, como priorizar frases curtas, destacar limitações ou adotar uma terminologia técnica.</p></TooltipContent></Tooltip></div>
                <Textarea value={perfil.instrucoesPersonalizadas} maxLength={2000} onChange={evento => setPerfil(atual => ({ ...atual, instrucoesPersonalizadas: evento.target.value }))} placeholder="Ex.: priorize frases curtas e linguagem impessoal." />
                <p className="text-xs text-muted-foreground">{perfil.instrucoesPersonalizadas.length}/2000 caracteres</p>
              </div>
              </TooltipProvider>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setPerfil(PERFIL_RESPOSTA_IA_PADRAO)}>Restaurar padrão</Button>
                <Button type="button" onClick={() => void salvarPerfil()} disabled={salvandoPerfil}>{salvandoPerfil ? 'Salvando...' : 'Salvar preferências'}</Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Card: Configuração do Provedor ── */}
          <Dialog open={configuracaoAberta} onOpenChange={alterarAberturaConfiguracao}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Configuração do provedor</DialogTitle>
                <DialogDescription>Escolha o modelo, informe a chave e teste a conexão.</DialogDescription>
              </DialogHeader>
              <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound size={18} className="text-primary" />
                Configuração do Provedor
              </CardTitle>
              <CardDescription>
                Selecione o provedor de IA, o modelo desejado e insira sua chave de API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Provedor de IA */}
              <FormField
                control={form.control}
                name="provedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provedor de IA</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o provedor..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gemini">
                          <span className="flex items-center gap-2">
                            Google Gemini
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Recomendado
                            </Badge>
                          </span>
                        </SelectItem>
                        <SelectItem value="groq">Groq (LLaMA, Mixtral)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Modelo Padrão (dinâmico conforme provedor) */}
              <FormField
                control={form.control}
                name={modelFieldName}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo Padrão — {provedorNome}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {modelOptions.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Chave de API (dinâmica conforme provedor) */}
              <FormField
                control={form.control}
                name={apiKeyFieldName}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave de API — {provedorNome}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={mostrarChave ? 'text' : 'password'}
                          placeholder={apiKeyPlaceholder}
                          {...field}
                          value={field.value || ''}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                          onClick={() => setMostrarChave((v) => !v)}
                        >
                          {mostrarChave ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {testando && (
                <Alert className="border-primary/30 bg-primary/5" role="status" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <AlertTitle>Testando conexão — {formatarTempoTeste(tempoTesteSegundos)}</AlertTitle>
                  <AlertDescription>
                    O provedor está processando uma solicitação mínima. Você pode cancelar ou fechar esta janela sem ficar preso ao teste.
                  </AlertDescription>
                </Alert>
              )}

              {!testando && testResult && (
                <Alert className={testResult.status === 'success'
                  ? 'border-green-600/30 bg-green-500/5 dark:border-green-500/40 dark:bg-green-500/10'
                  : testResult.status === 'cancelado'
                    ? 'border-muted-foreground/30 bg-muted/50'
                    : 'border-destructive/40 bg-destructive/5'} role="status">
                  {testResult.status === 'success'
                    ? <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    : testResult.status === 'cancelado'
                      ? <Square className="h-4 w-4 text-muted-foreground" />
                      : <AlertTriangle className="h-4 w-4 text-destructive" />}
                  <AlertTitle>{testResult.title}</AlertTitle>
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}

              {/* Ações */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant={testando ? 'destructive' : 'outline'}
                  onClick={() => testando ? void cancelarTesteConexao() : void handleTestarConexao()}
                  disabled={!testando && !chaveAtual}
                  className="gap-2"
                >
                  {testando ? (
                    <Square size={16} />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {testando ? `Cancelar teste · ${formatarTempoTeste(tempoTesteSegundos)}` : 'Testar Conexão'}
                </Button>
                <Button type="button" onClick={() => void handleSalvar()} disabled={salvando || testando} className="gap-2">
                  <Save size={16} />
                  {salvando ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
            </CardContent>
              </Card>
            </DialogContent>
          </Dialog>

          {/* ── Card: Como Obter sua Chave de API ── */}
          <Dialog open={guiaChaveAberto} onOpenChange={setGuiaChaveAberto}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Como obter sua chave de API</DialogTitle>
                <DialogDescription>Passo a passo para gerar uma chave no provedor escolhido.</DialogDescription>
              </DialogHeader>
              <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen size={18} className="text-primary" />
                Como Obter sua Chave de API
              </CardTitle>
              <CardDescription>
                Siga as instruções abaixo para criar sua chave de API gratuitamente.
                O sistema está preparado para os provedores <strong>Google Gemini</strong> e{' '}
                <strong>Groq</strong>. Outros provedores serão disponibilizados em atualizações futuras.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible defaultValue="gemini">
                {/* Gemini — Recomendado */}
                <AccordionItem value="gemini">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      Google Gemini
                      <Badge className="text-[10px] px-1.5 py-0">
                        Recomendado
                      </Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pl-1">
                      <ol className="list-decimal ml-4 space-y-2 text-sm text-muted-foreground">
                        <li>
                          Acesse{' '}
                          <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            aistudio.google.com/apikey
                            <ExternalLink size={12} />
                          </a>
                        </li>
                        <li>
                          Faça login com seu email institucional{' '}
                          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                            @policiacientifica.pr.gov.br
                          </code>
                        </li>
                        <li>Clique em <strong>&quot;Criar chave de API&quot;</strong> (ou &quot;Create API Key&quot;)</li>
                        <li>Copie a chave gerada e cole no campo <em>&quot;Chave de API&quot;</em> acima</li>
                      </ol>
                      <p className="text-xs text-muted-foreground/80 mt-2">
                        <strong>Cota gratuita:</strong> O Google AI Studio oferece cota gratuita generosa.
                        Modelos Gemini têm excelente desempenho em português jurídico/técnico.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Groq */}
                <AccordionItem value="groq">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      Groq (LLaMA, Mixtral)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pl-1">
                      <ol className="list-decimal ml-4 space-y-2 text-sm text-muted-foreground">
                        <li>
                          Acesse{' '}
                          <a
                            href="https://console.groq.com/keys"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            console.groq.com/keys
                            <ExternalLink size={12} />
                          </a>
                        </li>
                        <li>Crie uma conta gratuita ou faça login</li>
                        <li>Clique em <strong>&quot;Create API Key&quot;</strong></li>
                        <li>Copie a chave gerada e cole no campo <em>&quot;Chave de API&quot;</em> acima</li>
                      </ol>
                      <p className="text-xs text-muted-foreground/80 mt-2">
                        <strong>Uso gratuito:</strong> A Groq oferece créditos gratuitos para desenvolvedores.
                        Verifique os limites em{' '}
                        <a
                          href="https://groq.com/pricing"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          groq.com/pricing
                          <ExternalLink size={12} />
                        </a>.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Nota: novos provedores futuros */}
              <p className="mt-4 text-xs text-muted-foreground/70 text-center">
                🔌 Suporte a novos provedores de IA será adicionado em versões futuras do sistema.
              </p>
            </CardContent>
              </Card>
            </DialogContent>
          </Dialog>
        </form>
      </Form>
    </div>
  );
};

