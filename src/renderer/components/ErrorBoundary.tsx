import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Componente para capturar erros não tratados no React
 * Exibe uma interface amigável de erro com opções de recuperação
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Atualiza o state para exibir a UI de fallback
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log do erro para serviço de monitoramento
    console.error('❌ Erro não tratado no React:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // Armazenar informações do erro
    this.setState({ error, errorInfo });

    // Tentar enviar para logs do sistema
    try {
      if (window.electronAPI?.logError) {
        window.electronAPI.logError(
          'Erro no React',
          `${error.message}\n${error.stack}\n${errorInfo.componentStack}`
        );
      }
    } catch (apiError) {
      console.error('Erro ao tentar logar erro via IPC:', apiError);
    }
  }

  private handleRestartApp = (): void => {
    try {
      if (window.electronAPI?.restartApp) {
        window.electronAPI.restartApp();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Erro ao tentar reiniciar aplicação:', error);
      window.location.reload();
    }
  };

  private handleClearCache = (): void => {
    try {
      if (window.electronAPI?.clearCache) {
        window.electronAPI.clearCache();
      } else {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  };

  private handleGoToHome = (): void => {
    try {
      window.location.href = '/';
    } catch (error) {
      console.error('Erro ao navegar para home:', error);
    }
  };

  private handleReportError = (): void => {
    try {
      const { error, errorInfo } = this.state;
      const errorDetails = {
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };

      // Abrir email para reportar erro
      const subject = encodeURIComponent('Erro no Laudo Pericial');
      const body = encodeURIComponent(
        `Detalhes do erro:\n\n${JSON.stringify(errorDetails, null, 2)}`
      );
      window.open(`mailto:support@pcpr.pr.gov.br?subject=${subject}&body=${body}`, '_blank');
    } catch (error) {
      console.error('Erro ao criar report:', error);
    }
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // UI de fallback personalizada
      return (
        fallback || (
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 animate-fade-in">
              <div className="flex flex-col items-center text-center">
                {/* Ícone de erro */}
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                  <svg
                    className="w-10 h-10 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>

                {/* Título */}
                <h1 className="text-3xl font-bold text-gray-900 mb-3">Ops! Algo deu errado</h1>
                <p className="text-gray-600 mb-8">
                  Ocorreu um erro inesperado no aplicativo. Por favor, tente uma das opções abaixo.
                </p>

                {/* Detalhes do erro (expandível) */}
                <details className="w-full mb-8">
                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium mb-2">
                    Ver detalhes técnicos do erro
                  </summary>
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg text-left">
                    <p className="font-mono text-sm text-gray-800 break-words mb-2">
                      <strong>Mensagem:</strong> {error?.message || 'Erro desconhecido'}
                    </p>
                    {error?.stack && (
                      <pre className="text-xs text-gray-600 overflow-auto max-h-40 p-3 bg-gray-800 text-gray-100 rounded">
                        {error.stack}
                      </pre>
                    )}
                    {errorInfo?.componentStack && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Componente:</p>
                        <pre className="text-xs text-gray-600 overflow-auto max-h-32 p-3 bg-gray-200 rounded">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>

                {/* Opções de recuperação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <button
                    onClick={this.handleRestartApp}
                    className="flex items-center justify-center gap-2 p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Reiniciar Aplicação
                  </button>

                  <button
                    onClick={this.handleGoToHome}
                    className="flex items-center justify-center gap-2 p-4 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors duration-200 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    Voltar para Início
                  </button>

                  <button
                    onClick={this.handleClearCache}
                    className="flex items-center justify-center gap-2 p-4 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 transition-colors duration-200 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Limpar Cache
                  </button>

                  <button
                    onClick={this.handleReportError}
                    className="flex items-center justify-center gap-2 p-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors duration-200 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Reportar Erro
                  </button>
                </div>

                {/* Informações de contato */}
                <div className="mt-10 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Se o problema persistir, entre em contato com o suporte:
                  </p>
                  <p className="text-sm font-medium text-gray-700 mt-1">
                    📧 support@pcpr.pr.gov.br | 📞 (41) 3270-9100
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      );
    }

    return children;
  }
}

/**
 * Hook para usar o ErrorBoundary funcionalmente
 */
export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    console.error('Erro capturado:', error);
    setError(error);

    // Log para sistema
    try {
      if (window.electronAPI?.logError) {
        window.electronAPI.logError('Erro capturado via hook', error.message);
      }
    } catch (apiError) {
      console.error('Erro ao logar via IPC:', apiError);
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
};

export default ErrorBoundary;
