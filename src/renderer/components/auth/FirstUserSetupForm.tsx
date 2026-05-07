import React from 'react';
import logo from '@/assets/logo.jpg';

interface FirstUserData {
  nome: string;
  username: string;
  email: string;
  cargo: string;
  lotacao: string;
  senha: string;
}

interface FirstUserSetupFormProps {
  data: FirstUserData;
  loading: boolean;
  error: string | null;
  success: string | null;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  fieldErrors?: Partial<Record<keyof FirstUserData, string>>;
  onChange: (data: FirstUserData) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const FirstUserSetupForm: React.FC<FirstUserSetupFormProps> = ({
  data,
  loading,
  error,
  success,
  isDarkMode,
  onToggleTheme,
  fieldErrors,
  onChange,
  onSubmit,
}) => {
  const updateField = (field: keyof FirstUserData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-100 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="mx-auto max-w-xl">
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Primeiro acesso</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Nenhum usuário foi encontrado. Cadastre o primeiro usuário para liberar o sistema.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nome completo</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                value={data.nome}
                onChange={(e) => updateField('nome', e.target.value)}
                placeholder="Seu nome completo"
              />
              {fieldErrors?.nome && <p className="mt-1 text-sm text-red-600">{fieldErrors.nome}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nome de usuário</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                value={data.username}
                onChange={(e) => updateField('username', e.target.value)}
                placeholder="usuario.perito"
              />
              {fieldErrors?.username && <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail</label>
              <input
                type="email"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                value={data.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="email@pcp.pr.gov.br"
              />
              {fieldErrors?.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cargo</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                value={data.cargo}
                onChange={(e) => updateField('cargo', e.target.value)}
              >
                <option value="Perito Oficial Criminal">Perito Oficial Criminal</option>
                <option value="Técnico de Perícia Oficial">Técnico de Perícia Oficial</option>
              </select>
              {fieldErrors?.cargo && <p className="mt-1 text-sm text-red-600">{fieldErrors.cargo}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lotação</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                value={data.lotacao}
                onChange={(e) => updateField('lotacao', e.target.value)}
                placeholder="Ex: Instituto de Criminalística"
              />
              {fieldErrors?.lotacao && <p className="mt-1 text-sm text-red-600">{fieldErrors.lotacao}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Senha</label>
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
                value={data.senha}
                onChange={(e) => updateField('senha', e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              {fieldErrors?.senha && <p className="mt-1 text-sm text-red-600">{fieldErrors.senha}</p>}
            </div>

            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
            {success && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
          >
              {loading ? 'Cadastrando...' : 'Cadastrar primeiro usuário'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
