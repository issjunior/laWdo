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
import { Eye, EyeOff, Save, CheckCircle, AlertTriangle, Loader2, Info } from 'lucide-react';

const iaConfigSchema = z.object({
  apiKey: z.string().optional(),
  modeloPadrao: z.string().min(1, 'Selecione um modelo'),
});

type IAConfigForm = z.infer<typeof iaConfigSchema>;

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
      apiKey: '',
      modeloPadrao: 'llama-3.3-70b-versatile',
    },
    mode: 'onBlur',
  });

  const carregarConfig = useCallback(async () => {
    try {
      const rKey = await window.ipcAPI.configuracao.obter('api_key_groq');
      if (rKey.success && rKey.data) {
        form.setValue('apiKey', rKey.data);
      }

      const rModelo = await window.ipcAPI.configuracao.obter('modelo_ia_padrao');
      if (rModelo.success && rModelo.data) {
        form.setValue('modeloPadrao', rModelo.data);
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

      const r1 = await window.ipcAPI.configuracao.salvar(
        'api_key_groq',
        data.apiKey || '',
        'texto',
        'Chave de API Groq para integração com IA'
      );

      const r2 = await window.ipcAPI.configuracao.salvar(
        'modelo_ia_padrao',
        data.modeloPadrao,
        'texto',
        'Modelo padrão Groq'
      );

      if (r1.success && r2.success) {
        setSuccess('Configurações salvas com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r1.error || r2.error || 'Erro ao salvar configurações');
      }
    } catch (_e) {
      setError('Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  });

  const handleTestarConexao = async () => {
    try {
      setTestando(true);
      setError(null);
      setTestSuccess(null);

      const r = await window.ipcAPI.ia.perguntar('Diga apenas "OK" sem nenhum texto adicional.', '');

      if (r.success && r.data && (r.data as string).toLowerCase().includes('ok')) {
        setTestSuccess('Conexão com a Groq API estabelecida com sucesso!');
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
          Configure a integração com IA (Groq) para assistência na escrita de laudos.
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
          {/* Configuração da API Groq */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuração Groq API</CardTitle>
              <CardDescription>
                Insira sua chave de API da Groq para habilitar o assistente de IA nos laudos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Chave de API */}
              <FormField
                control={form.control}
                name="apiKey"
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

              {/* Modelo Padrão */}
              <FormField
                control={form.control}
                name="modeloPadrao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo Padrão</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="llama-3.3-70b-versatile">
                          Llama 3.3 70B (padrão — recomendado)
                        </SelectItem>
                        <SelectItem value="meta-llama/llama-4-scout-17b-16e-instruct">
                          Llama 4 Scout 17B Instruct (Multimodal / Imagens)
                        </SelectItem>
                        <SelectItem value="gemma2-9b-it">Gemma 2 9B</SelectItem>
                        <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B</SelectItem>
                      </SelectContent>
                    </Select>
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
                  disabled={testando || !form.watch('apiKey')}
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

          {/* Card de Instruções */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info size={18} className="text-muted-foreground" />
                Informações de Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Sua chave fica segura:</strong> A chave de API é armazenada
                localmente no banco de dados SQLite do aplicativo (fora da árvore do
                projeto). As chamadas para a API Groq são feitas pelo processo
                principal do Electron — a chave <strong>nunca</strong> é exposta no
                navegador/renderer.
              </p>
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
              <p>
                <strong>Dados sensíveis:</strong> Ao usar IA, o conteúdo das seções
                do laudo é enviado para os servidores da Groq. Não envie dados
                pessoais sensíveis ou sigilosos sem avaliação prévia.
              </p>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
};

export default ModelosIAPage;
