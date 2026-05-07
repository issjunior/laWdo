import React from 'react';
import logo from '@/assets/logo.jpg';

interface LoginFormProps {
  username: string;
  password: string;
  loading: boolean;
  error: string | null;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  password,
  loading,
  error,
  isDarkMode,
  onToggleTheme,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-100 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-7 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={onToggleTheme}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isDarkMode ? 'Tema claro' : 'Tema escuro'}
            </button>
          </div>
          <div className="mb-6 flex flex-col items-center text-center">
            <img src={logo} alt="laWdo" className="mb-4 h-20 w-20 rounded-2xl object-cover shadow-md" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Acesso ao laWdo</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Entre com suas credenciais para acessar o sistema.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Usuário</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="usuario.perito"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Senha</label>
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Digite sua senha"
              />
            </div>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
