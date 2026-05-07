import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, AlertCircle } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const perfilValidationSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  username: z
    .string()
    .min(3, 'Nome de usuário deve ter pelo menos 3 caracteres')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Use apenas letras, números, ponto, underline e hífen'),
  email: z.string().email('E-mail inválido'),
  cargo: z.enum(['Perito Oficial Criminal', 'Técnico de Perícia Oficial']),
  lotacao: z.string().min(3, 'Lotação deve ter pelo menos 3 caracteres'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type PerfilCadastroFormValues = z.infer<typeof perfilValidationSchema>;

const AUTH_USER_KEY = 'lawdo_auth_user';

export const PerfilPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<PerfilCadastroFormValues>({
    resolver: zodResolver(perfilValidationSchema),
    defaultValues: {
      nome: '',
      username: '',
      email: '',
      cargo: 'Perito Oficial Criminal',
      lotacao: '',
      senha: '',
    },
  });

  useEffect(() => {
    const rawUser = sessionStorage.getItem(AUTH_USER_KEY);
    if (!rawUser) {
      return;
    }

    try {
      const user = JSON.parse(rawUser);
      form.reset({
        nome: user?.name || '',
        username: user?.username || '',
        email: user?.email || '',
        cargo: 'Perito Oficial Criminal',
        lotacao: '',
        senha: '',
      });
    } catch {
      // sem ação
    }
  }, [form]);

  const onSubmit = async (data: PerfilCadastroFormValues) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const result = await window.ipcAPI.user.create({
        nome: data.nome,
        username: data.username,
        email: data.email,
        senha: data.senha,
        cargo: data.cargo,
        lotacao: data.lotacao,
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro ao cadastrar usuário');
      }

      setSuccess('Usuário cadastrado com sucesso.');
      form.reset({
        nome: '',
        username: '',
        email: '',
        cargo: 'Perito Oficial Criminal',
        lotacao: '',
        senha: '',
      });
    } catch (err: any) {
      console.error('Erro ao cadastrar usuário:', err);
      setError(err.message || 'Erro ao cadastrar usuário.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center text-gray-500">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <User className="h-8 w-8 text-gray-500" />
        <div>
          <h1 className="text-3xl font-bold">Cadastro de Usuário</h1>
          <p className="text-gray-600 mt-1">Preencha os dados do perito para acesso ao sistema</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="text-green-800">{success}</div>
        </div>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Usuário</CardTitle>
          <CardDescription>Os campos marcados com * são obrigatórios.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Seu nome completo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome de usuário *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="usuario.perito" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="email@pcp.pr.gov.br" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cargo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cargo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Perito Oficial Criminal">Perito Oficial Criminal</SelectItem>
                          <SelectItem value="Técnico de Perícia Oficial">Técnico de Perícia Oficial</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lotacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lotação *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Instituto de Criminalística" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="senha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha *</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} placeholder="Mínimo 6 caracteres" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Limpar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Cadastrar Usuário'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
