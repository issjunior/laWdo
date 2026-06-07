import React, { useState, useEffect, useCallback } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Lock,
  Server,
  KeyRound,
  BookOpen,
} from 'lucide-react';

const iaConfigSchema = z.object({
  provedor: z.enum(['groq', 'gemini']),
  apiKeyGroq: z.string().optional(),
  apiKeyGemini: z.string().optional(),
  modeloGroq: z.string().default('llama-3.3-70b-versatile'),
  modeloGemini: z.string().default('gemini-2.5-flash'),
});

type IAConfigForm = z.infer<typeof iaConfigSchema>;

const GROQ_MODEL_OPTIONS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (padrão — recomendado)' },
  { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B Instruct (Multimodal / Imagens)' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
];

const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (padrão — recomendado)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (raciocínio avançado)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

export const ModelosIAPage: React.FC = () => {
  const [mostrarChave, setMostrarChave] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error', message: string } | null>(null);

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
    } catch (_e) {
      console.error('Erro ao carregar configurações IA:', _e);
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
        window.ipcAPI.configuracao.salvar('api_key_groq', data.apiKeyGroq || '', 'texto', 'Chave de API Groq'),
        window.ipcAPI.configuracao.salvar('api_key_gemini', data.apiKeyGemini || '', 'texto', 'Chave de API Gemini'),
        window.ipcAPI.configuracao.salvar('modelo_ia_padrao', data.modeloGroq, 'texto', 'Modelo padrão Groq'),
        window.ipcAPI.configuracao.salvar('modelo_gemini_padrao', data.modeloGemini, 'texto', 'Modelo padrão Gemini'),
      ]);

      const falha = resultados.find((r) => !r.success);
      if (falha) {
        setError(falha.error || 'Erro ao salvar configurações');
      } else {
        setSuccess('Configurações salvas com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (_e) {
      setError('Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  });

  const chaveAtual = provedor === 'gemini' ? form.watch('apiKeyGemini') : form.watch('apiKeyGroq');
  const provedorNome = provedor === 'gemini' ? 'Gemini' : 'Groq';

  const handleTestarConexao = async () => {
    try {
      setTestando(true);
      setError(null);
      setTestResult(null);

      const r = await window.ipcAPI.ia.perguntar('Diga apenas "OK" sem nenhum texto adicional.', '');

      if (r.success && r.data && (r.data as string).toLowerCase().includes('ok')) {
        const msg = `Conexão com a API ${provedorNome} estabelecida com sucesso!`;
        setTestResult({ status: 'success', message: msg });
        window.ipcAPI.logInfo('IA', msg);
      } else if (!r.success) {
        const erroDetalhe = r.error ? `\n\nDetalhes do erro: ${r.error}` : '';
        const msg = `Ops! Não conseguimos conectar com o ${provedorNome}. Por favor, confira se a sua chave de API está correta e tente novamente.${erroDetalhe}`;
        setTestResult({ status: 'error', message: msg });
        window.ipcAPI.logError('IA', msg, r.error);
      } else {
        const msg = `Ops! O ${provedorNome} retornou uma resposta inesperada. Confira se a sua chave está correta e tente novamente.`;
        setTestResult({ status: 'error', message: msg });
        window.ipcAPI.logError('IA', msg, r.data);
      }
    } catch (_e: any) {
      const erroTecnico = _e?.message || 'Erro desconhecido';
      const msg = `Ops! Algo deu errado ao tentar falar com o ${provedorNome}. Verifique sua conexão e sua chave de API.\n\nDetalhes: ${erroTecnico}`;
      setTestResult({ status: 'error', message: msg });
      window.ipcAPI.logError('IA', msg, _e);
    } finally {
      setTestando(false);
    }
  };

  const modelOptions = provedor === 'gemini' ? GEMINI_MODEL_OPTIONS : GROQ_MODEL_OPTIONS;
  const modelFieldName = provedor === 'gemini' ? 'modeloGemini' as const : 'modeloGroq' as const;
  const apiKeyFieldName = provedor === 'gemini' ? 'apiKeyGemini' as const : 'apiKeyGroq' as const;
  const apiKeyPlaceholder = provedor === 'gemini' ? 'AIza...' : 'gsk_...';

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* ── Título da Página ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Modelos de IA</h1>
        <p className="text-muted-foreground mt-1">
          Configure a integração com IA para assistência na escrita de laudos periciais.
          Atualmente o sistema suporta <strong>Google Gemini</strong> e <strong>Groq</strong> —
          novos provedores serão adicionados em versões futuras.
        </p>
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
      <Dialog open={!!testResult} onOpenChange={(open) => !open && setTestResult(null)}>
        <DialogContent className="sm:max-w-[425px] text-center">
          <DialogHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4">
              {testResult?.status === 'success' ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
              )}
            </div>
            <DialogTitle className="text-center text-xl">
              Teste de Conexão: {testResult?.status === 'success' ? 'Sucesso' : 'Falha'}
            </DialogTitle>
            <DialogDescription className="text-center mt-2 text-base whitespace-pre-line">
              {testResult?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center mt-4">
            <Button onClick={() => setTestResult(null)} className="w-full sm:w-auto min-w-[120px]">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Form {...form}>
        <form onSubmit={handleSalvar} className="space-y-6">
          {/* ── Card: Configuração do Provedor ── */}
          <Card>
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

              {/* Ações */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestarConexao}
                  disabled={testando || !chaveAtual}
                  className="gap-2"
                >
                  {testando ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {testando ? 'Testando...' : 'Testar Conexão'}
                </Button>
                <Button type="submit" disabled={salvando} className="gap-2">
                  <Save size={16} />
                  {salvando ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Card: Como Obter sua Chave de API ── */}
          <Card>
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
                        <li>Clique em <strong>"Criar chave de API"</strong> (ou "Create API Key")</li>
                        <li>Copie a chave gerada e cole no campo <em>"Chave de API"</em> acima</li>
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
                        <li>Clique em <strong>"Create API Key"</strong></li>
                        <li>Copie a chave gerada e cole no campo <em>"Chave de API"</em> acima</li>
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
        </form>
      </Form>
    </div>
  );
};

export default ModelosIAPage;
