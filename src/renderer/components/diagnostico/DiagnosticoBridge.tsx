import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface DiagnosticoBridgeProps {
  currentUser: Record<string, unknown> | null;
  painelIlustracoes: boolean;
}

function extrairUsuarioSeguro(currentUser: Record<string, unknown> | null) {
  if (!currentUser || typeof currentUser !== 'object') {
    return null;
  }

  return {
    id: currentUser.id ?? null,
    role: currentUser.role ?? currentUser.cargo ?? null,
    cargo: currentUser.cargo ?? null,
    lotacao: currentUser.lotacao ?? null,
  };
}

export function DiagnosticoBridge({ currentUser, painelIlustracoes }: DiagnosticoBridgeProps) {
  const location = useLocation();

  useEffect(() => {
    window.ipcAPI.diagnosticoInterno.atualizarContextoRenderer({
      rota: `${location.pathname}${location.search}${location.hash}`,
      hash: window.location.hash,
      tituloJanela: document.title,
      painelIlustracoes,
      usuario: extrairUsuarioSeguro(currentUser),
    });
  }, [currentUser, location.hash, location.pathname, location.search, painelIlustracoes]);

  useEffect(() => {
    const enviarErro = (payload: {
      message: string;
      stack?: string;
      source?: string;
      lineno?: number;
      colno?: number;
      tipo: 'error' | 'unhandledrejection';
    }) => {
      window.ipcAPI.diagnosticoInterno.registrarErroFatalRenderer({
        ...payload,
        rota: `${location.pathname}${location.search}${location.hash}`,
        hash: window.location.hash,
      });
    };

    const onError = (event: ErrorEvent) => {
      enviarErro({
        tipo: 'error',
        message: event.message || 'Erro global sem mensagem',
        stack: event.error instanceof Error ? event.error.stack : undefined,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      enviarErro({
        tipo: 'unhandledrejection',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [location.hash, location.pathname, location.search]);

  return null;
}
