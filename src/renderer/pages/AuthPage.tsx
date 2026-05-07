import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { FirstUserSetupForm } from '@/components/auth/FirstUserSetupForm';
import { LoginForm } from '@/components/auth/LoginForm';

interface AuthPageProps {
  onAuthenticated: (user: any) => void;
}

interface FirstUserData {
  nome: string;
  username: string;
  email: string;
  cargo: string;
  lotacao: string;
  senha: string;
}

const firstUserSchema = z.object({
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

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  const [registerData, setRegisterData] = useState<FirstUserData>({
    nome: '',
    username: '',
    email: '',
    cargo: 'Perito Oficial Criminal',
    lotacao: '',
    senha: '',
  });
  const [registerFieldErrors, setRegisterFieldErrors] = useState<
    Partial<Record<keyof FirstUserData, string>>
  >({});
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  useEffect(() => {
    const checkUsers = async () => {
      try {
        const result = await window.ipcAPI.user.findActivePeritos();
        const total = Array.isArray(result?.data) ? result.data.length : 0;
        setHasUsers(total > 0);
      } catch {
        setHasUsers(true);
      }
    };

    checkUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await window.ipcAPI.login(username, password);
      if (!result?.success || !result?.user) {
        throw new Error(result?.error || 'Credenciais inválidas');
      }
      onAuthenticated(result.user);
    } catch (err: any) {
      setError(err.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterFirstUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterFieldErrors({});
    setRegisterLoading(true);

    try {
      const validation = firstUserSchema.safeParse(registerData);
      if (!validation.success) {
        const fieldErrors: Partial<Record<keyof FirstUserData, string>> = {};
        validation.error.issues.forEach((issue) => {
          const key = issue.path[0] as keyof FirstUserData;
          fieldErrors[key] = issue.message;
        });
        setRegisterFieldErrors(fieldErrors);
        return;
      }

      const result = await window.ipcAPI.user.create({
        nome: validation.data.nome,
        username: validation.data.username,
        email: validation.data.email,
        senha: validation.data.senha,
        cargo: validation.data.cargo,
        lotacao: validation.data.lotacao,
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao cadastrar usuário');
      }

      const loginResult = await window.ipcAPI.login(validation.data.username, validation.data.senha);
      if (!loginResult?.success || !loginResult?.user) {
        setRegisterSuccess('Usuário cadastrado com sucesso. Faça login para continuar.');
        setHasUsers(true);
        setUsername(validation.data.username);
      } else {
        onAuthenticated(loginResult.user);
      }
    } catch (err: any) {
      setRegisterError(err.message || 'Falha no cadastro inicial');
    } finally {
      setRegisterLoading(false);
    }
  };

  if (hasUsers === null) {
    return (
      <div className="container mx-auto p-6 max-w-md">
        <div className="bg-white border rounded-lg p-6 shadow-sm mt-16">
          <p className="text-gray-600">Verificando usuários cadastrados...</p>
        </div>
      </div>
    );
  }

  if (!hasUsers) {
    return (
      <FirstUserSetupForm
        data={registerData}
        loading={registerLoading}
        error={registerError}
        success={registerSuccess}
        fieldErrors={registerFieldErrors}
        onChange={setRegisterData}
        onSubmit={handleRegisterFirstUser}
      />
    );
  }

  return (
    <LoginForm
      username={username}
      password={password}
      loading={loading}
      error={error}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      onSubmit={handleLogin}
    />
  );
};
