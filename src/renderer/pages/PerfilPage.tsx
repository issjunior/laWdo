import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PerfilPeritoFormValues } from '@/lib/validators';

// Schema de validação para perfil
const perfilValidationSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  matricula: z.string().min(4, 'Matrícula deve ter pelo menos 4 caracteres'),
  cargo: z.string().min(3, 'Cargo deve ter pelo menos 3 caracteres'),
  telefone: z.string().optional(),
  lotacao: z.string().min(3, 'Lotação deve ter pelo menos 3 caracteres'),
});

export const PerfilPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<PerfilPeritoFormValues>({
    resolver: zodResolver(perfilValidationSchema),
    defaultValues: {
      nome: '',
      email: '',
      matricula: '',
      cargo: '',
      telefone: '',
      lotacao: '',
    },
  });

  // Carregar dados do perfil do usuário logado
  useEffect(() => {
    carregarPerfil();
  }, []);

  const carregarPerfil = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obter app info primeiro
      // (app info não necessário no momento, apenas placeholder)

      // TODO: Implementar busca real do perfil
      // Por ora, vamos buscar usuários ativos e pegar o primeiro como exemplo
      const result = await window.ipcAPI.user.findActivePeritos();

      if (result.success && result.data && result.data.length > 0) {
        const perito = result.data[0];
        form.reset({
          nome: perito.nome || '',
          email: perito.email || '',
          matricula: perito.matricula || '',
          cargo: perito.cargo || '',
          telefone: perito.telefone || '',
          lotacao: perito.lotacao || '',
        });
      } else {
        setError('Nenhum perito ativo encontrado no sistema.');
      }
    } catch (err: any) {
      console.error('Erro ao carregar perfil:', err);
      setError(err.message || 'Erro ao carregar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PerfilPeritoFormValues) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // TODO: Obter o ID do usuário logado (deve vir da autenticação)
      // Por ora, vamos buscar o primeiro usuário ativo novamente
      const userResult = await window.ipcAPI.user.findActivePeritos();
      if (!userResult.success || !userResult.data || userResult.data.length === 0) {
        throw new Error('Nenhum usuário ativo encontrado para atualizar.');
      }

      const userId = userResult.data[0].id;

      // Atualizar perfil
      const result = await window.ipcAPI.user.updateProfile(userId, data);

      if (result.success) {
        setSuccess('Perfil atualizado com sucesso!');
      } else {
        throw new Error(result.error || 'Erro desconhecido ao salvar');
      }
    } catch (err: any) {
      console.error('Erro ao salvar perfil:', err);
      setError(err.message || 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center text-gray-500">Carregando perfil...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <User className="h-8 w-8 text-gray-500" />
        <div>
          <h1 className="text-3xl font-bold">Meu Perfil</h1>
          <p className="text-gray-600 mt-1">
            Gerencie suas informações pessoais e profissionais
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Perito</CardTitle>
          <CardDescription>
            Atualize seus dados cadastrais. Os campos marcados com * são obrigatórios.
          </CardDescription>
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="email@pcp.pr.gov.br" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matrícula *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Número da matrícula" />
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
                      <FormControl>
                        <Input {...field} placeholder="Ex: Perito Criminal" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(41) 99999-9999" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Limpar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
