import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface AlteracoesPendentesContexto {
  registrar: (chave: string, pendente: boolean) => void;
}

const ContextoAlteracoesPendentes = createContext<AlteracoesPendentesContexto | null>(null);

export function AlteracoesPendentesProvider({ children }: { children: ReactNode }) {
  const [registros, setRegistros] = useState<Record<string, boolean>>({});
  const temAlteracoesPendentes = Object.values(registros).some(Boolean);

  const valor = useMemo(() => ({
    registrar: (chave: string, pendente: boolean) => setRegistros(atual => ({ ...atual, [chave]: pendente })),
  }), []);

  useEffect(() => {
    const impedirFechamento = (evento: BeforeUnloadEvent) => {
      if (!temAlteracoesPendentes) return;
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', impedirFechamento);
    return () => window.removeEventListener('beforeunload', impedirFechamento);
  }, [temAlteracoesPendentes]);

  useEffect(() => {
    const api = window.ipcAPI.atualizacao;
    if (!api) return;
    return api.onSolicitarReinicio(() => !temAlteracoesPendentes);
  }, [temAlteracoesPendentes]);

  return <ContextoAlteracoesPendentes.Provider value={valor}>{children}</ContextoAlteracoesPendentes.Provider>;
}

export function useRegistrarAlteracoesPendentes(chave: string, pendente: boolean): void {
  const contexto = useContext(ContextoAlteracoesPendentes);
  if (!contexto) throw new Error('O registro de alterações pendentes requer seu provider.');

  useEffect(() => {
    contexto.registrar(chave, pendente);
    return () => contexto.registrar(chave, false);
  }, [chave, contexto, pendente]);
}
