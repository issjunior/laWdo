import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, AlertCircle, KeyRound, Camera } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from '@/components/ui/avatar';
import { AvatarUploadDialog } from '@/components/avatar/AvatarUploadDialog';
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
  username: z.string().optional(),
  email: z.string().email('E-mail inválido'),
  cargo: z.enum(['Perito Oficial Criminal', 'Técnico de Perícia Oficial']),
  lotacao: z.string().min(3, 'Lotação deve ter pelo menos 3 caracteres'),
  senha: z.string().optional(),
  confirmarSenha: z.string().optional(),
}).refine(data => {
  if (data.senha && data.senha.length > 0) {
    return data.senha.length >= 6;
  }
  return true;
}, {
  message: 'A nova senha deve ter pelo menos 6 caracteres',
  path: ['senha']
}).refine(data => {
  if (data.senha) {
    return data.senha === data.confirmarSenha;
  }
  return true;
}, {
  message: 'As senhas não coincidem',
  path: ['confirmarSenha']
});

type PerfilUpdateFormValues = z.infer<typeof perfilValidationSchema>;

const AUTH_USER_KEY = 'lawdo_auth_user';

export const PerfilPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const form = useForm<PerfilUpdateFormValues>({
    resolver: zodResolver(perfilValidationSchema),
    defaultValues: {
      nome: '',
      username: '',
      email: '',
      cargo: 'Perito Oficial Criminal',
      lotacao: '',
      senha: '',
      confirmarSenha: '',
    },
  });

  const loadAvatar = useCallback(async () => {
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    if (!user?.id) return;

    if (user?.foto_url) {
      try {
        const result = await window.ipcAPI.user.getAvatar(user.id);
        if (result.success && result.data?.foto_url) {
          setFotoUrl(result.data.foto_url);
          return;
        }
      } catch { }
    }
    setFotoUrl(null);
  }, []);

  useEffect(() => {
    const rawUser = sessionStorage.getItem(AUTH_USER_KEY);
    if (!rawUser) {
      return;
    }

    try {
      const user = JSON.parse(rawUser);
      setUserId(user.id);
      form.reset({
        nome: user?.name || user?.nome || '',
        username: user?.username || '',
        email: user?.email || '',
        cargo: user?.cargo || 'Perito Oficial Criminal',
        lotacao: user?.lotacao || '',
        senha: '',
        confirmarSenha: '',
      });
      loadAvatar();
    } catch {
      // sem ação
    }
  }, [form, loadAvatar]);

  const onSubmit = async (data: PerfilUpdateFormValues) => {
    if (!userId) {
      setError('Usuário não autenticado.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updatePayload: any = { nome: data.nome, email: data.email, cargo: data.cargo, lotacao: data.lotacao };
      if (isChangingPassword && data.senha) {
        updatePayload.senha = data.senha;
      }
      const result = await window.ipcAPI.user.updateProfile(userId, updatePayload);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar perfil');
      }

      // Atualiza o sessionStorage com o novo nome
      const rawUser = sessionStorage.getItem(AUTH_USER_KEY);
      if (rawUser) {
        try {
          const user = JSON.parse(rawUser);
          user.name = data.nome;
          user.nome = data.nome;
          user.email = data.email;
          user.cargo = data.cargo;
          user.lotacao = data.lotacao;
          sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

          // Dispara um evento para atualizar o header
          window.dispatchEvent(new Event('storage'));
        } catch { }
      }

      setSuccess('Perfil atualizado com sucesso.');
      // Limpa e oculta a senha após sucesso
      form.setValue('senha', '');
      form.setValue('confirmarSenha', '');
      setIsChangingPassword(false);
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      setError(err.message || 'Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpdated = useCallback((newFotoUrl: string) => {
    setFotoUrl(newFotoUrl);
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    if (raw) {
      try {
        const user = JSON.parse(raw);
        user.foto_url = 'updated';
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        window.dispatchEvent(new Event('storage'));
      } catch { }
    }
  }, []);

  const userName = form.watch('nome') || 'Usuário';
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
          <h1 className="text-3xl font-bold">Meu Perfil</h1>
          <p className="text-gray-600 mt-1">Atualize as informações do seu perfil</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Foto de Perfil</CardTitle>
          <CardDescription>Clique no avatar para alterar sua foto.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setUploadDialogOpen(true)}
              className="relative rounded-full transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Avatar className="h-20 w-20">
                <AvatarImage src={fotoUrl || undefined} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <AvatarBadge className="h-3.5 w-3.5" />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </button>
            <div>
              <p className="font-medium">{userName}</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Camera className="mr-1 h-3 w-3" />
                {fotoUrl ? 'Alterar foto' : 'Adicionar foto'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Usuário</CardTitle>
          <CardDescription>Mantenha seus dados atualizados.</CardDescription>
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
                      <FormLabel>Nome de usuário</FormLabel>
                      <FormControl>
                        <Input {...field} disabled className="bg-gray-100 dark:bg-slate-800" />
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
                      <Select onValueChange={field.onChange} value={field.value}>
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

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="lotacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lotação (UETC) *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Telêmaco Borba" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-6 border-t">
                {!isChangingPassword ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsChangingPassword(true)}
                    className="flex items-center gap-2"
                  >
                    <KeyRound className="h-4 w-4" />
                    Alterar Senha
                  </Button>
                ) : (
                  <div className="space-y-4 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border">
                    <h3 className="font-medium flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      Nova Senha
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="senha"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Digite a nova senha</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} placeholder="Mínimo 6 caracteres" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmarSenha"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirme a nova senha</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} placeholder="Repita a nova senha" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsChangingPassword(false);
                        form.setValue('senha', '');
                        form.setValue('confirmarSenha', '');
                        form.clearErrors('senha');
                        form.clearErrors('confirmarSenha');
                      }}
                    >
                      Cancelar alteração de senha
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  const user = JSON.parse(sessionStorage.getItem(AUTH_USER_KEY) || '{}');
                  setIsChangingPassword(false);
                  form.reset({
                    nome: user?.name || user?.nome || '',
                    username: user?.username || '',
                    email: user?.email || '',
                    cargo: user?.cargo || 'Perito Oficial Criminal',
                    lotacao: user?.lotacao || '',
                    senha: '',
                    confirmarSenha: '',
                  });
                }}>
                  Restaurar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Atualizar Perfil'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {userId && (
        <AvatarUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          userId={userId}
          currentFotoUrl={fotoUrl}
          userName={userName}
          onAvatarUpdated={handleAvatarUpdated}
        />
      )}
    </div>
  );
};

