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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Save, CheckCircle, AlertTriangle, Loader2, Info, ShieldCheck } from 'lucide-react';

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
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

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
      setTestSuccess(null);

      const r = await window.ipcAPI.ia.perguntar('Diga apenas "OK" sem nenhum texto adicional.', '');

      if (r.success && r.data && (r.data as string).toLowerCase().includes('ok')) {
        setTestSuccess(`Conexão com a API ${provedorNome} estabelecida com sucesso!`);
        setTimeout(() => setTestSuccess(null), 3000);
      } else if (!r.success) {
        setError(r.error || 'Erro ao testar conexão');
      } else {
        setError('Resposta inesperada da API. Verifique sua chave.');
      }
    } catch (_e) {
      setError('Erro ao testar conexão');
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Modelos de IA</h1>
        <p className="text-muted-foreground mt-1">
          Configure a integração com IA (Groq ou Gemini) para assistência na escrita de laudos.
        </p>
      </div>

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
      {testSuccess && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-400">
            {testSuccess}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={handleSalvar} className="space-y-6">
          {/* Configuração do Provedor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuração {provedorNome} API</CardTitle>
              <CardDescription>
                {provedor === 'groq'
                  ? 'Insira sua chave de API da Groq para habilitar o assistente de IA nos laudos.'
                  : 'Insira sua chave de API do Gemini para habilitar o assistente de IA nos laudos.'}
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
                        <SelectItem value="groq">Groq (LLaMA, Mixtral)</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {provedor === 'groq' ? (
                <>
                  {/* Chave de API Groq */}
                  <FormField
                    control={form.control}
                    name="apiKeyGroq"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave de API Groq</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={mostrarChave ? 'text' : 'password'}
                              placeholder="gsk_..."
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Obtenha sua chave gratuitamente em{' '}
                          <a
                            href="https://console.groq.com/keys"
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:text-primary"
                          >
                            console.groq.com/keys
                          </a>
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Modelo Padrão Groq */}
                  <FormField
                    control={form.control}
                    name="modeloGroq"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo Padrão</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um modelo..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GROQ_MODEL_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <>
                  {/* Chave de API Gemini */}
                  <FormField
                    control={form.control}
                    name="apiKeyGemini"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave de API Gemini</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={mostrarChave ? 'text' : 'password'}
                              placeholder="AIza..."
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Obtenha sua chave gratuitamente em{' '}
                          <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:text-primary"
                          >
                            aistudio.google.com/apikey
                          </a>
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Modelo Padrão Gemini */}
                  <FormField
                    control={form.control}
                    name="modeloGemini"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo Padrão</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um modelo..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GEMINI_MODEL_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

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

          {/* Card de Instruções Gemini — uso institucional */}
          {provedor === 'gemini' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck size={18} className="text-muted-foreground" />
                  Gemini — Uso Institucional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong>Email institucional obrigatório:</strong> Para garantir a
                  privacidade e segurança dos dados periciais, crie sua conta no
                  Google AI Studio utilizando exclusivamente seu email institucional{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">@policiacientifica.pr.gov.br</code>.
                  O Google <strong>não</strong> utiliza dados enviados por contas
                  institucionais/enterprise para treinamento de modelos.
                </p>
                <p>
                  <strong>Como obter a chave:</strong>
                  <ol className="list-decimal ml-4 mt-1 space-y-1">
                    <li>Acesse{' '}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-primary"
                      >
                        aistudio.google.com/apikey
                      </a>
                    </li>
                    <li>Faça login com seu email @policiacientifica.pr.gov.br</li>
                    <li>Clique em &quot;Criar chave de API&quot;</li>
                    <li>Copie a chave e cole no campo acima</li>
                  </ol>
                </p>
                <p>
                  <strong>Cota gratuita:</strong> O Google AI Studio oferece cota
                  gratuita generosa para uso em desenvolvimento. Modelos Gemini
                  têm excelente desempenho em português jurídico/técnico.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Card de Instruções — Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info size={18} className="text-muted-foreground" />
                Informações de Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Sua chave fica segura:</strong> As chaves de API são
                armazenadas localmente no banco de dados SQLite do aplicativo
                (fora da árvore do projeto). As chamadas para as APIs são feitas
                pelo processo principal do Electron — as chaves{' '}
                <strong>nunca</strong> são expostas no navegador/renderer.
              </p>
              {provedor === 'groq' && (
                <p>
                  <strong>Uso gratuito:</strong> A Groq oferece créditos gratuitos
                  para desenvolvedores. Verifique os limites de rate e preços em{' '}
                  <a
                    href="https://groq.com/pricing"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-primary"
                  >
                    groq.com/pricing
                  </a>.
                </p>
              )}
              <p>
                <strong>Dados sensíveis:</strong> Ao usar IA, o conteúdo das seções
                do laudo é enviado para os servidores do provedor configurado
                (Groq ou Google). Não envie dados pessoais sensíveis ou sigilosos
                sem avaliação prévia.
              </p>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
};

export default ModelosIAPage;
