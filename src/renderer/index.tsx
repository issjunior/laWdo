import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Tipos globais para TypeScript
declare global {
  interface Window {
    ipcAPI: any;
  }
}

// Verificar se estamos no contexto do Electron
const isElectron = typeof window !== 'undefined' && window.ipcAPI;

// Componente de carregamento inicial
const LoadingScreen = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '20px',
    }}
  >
    <div
      style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(255,255,255,0.3)',
        borderTop: '4px solid white',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px',
      }}
    />
    <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Laudo Pericial PCP</h1>
    <p style={{ fontSize: '16px', opacity: 0.8 }}>
      {isElectron ? 'Inicializando aplicação...' : 'Aguardando conexão...'}
    </p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Função para inicializar a aplicação
const initApp = async () => {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    console.error('Elemento root não encontrado');
    return;
  }

  const root = ReactDOM.createRoot(rootElement);

  // Mostrar tela de carregamento inicial
  root.render(<LoadingScreen />);

  try {
    // Verificar se estamos no Electron
    if (!isElectron) {
      console.warn(
        '⚠️ Não está no contexto do Electron. Algumas funcionalidades podem não funcionar.'
      );

      // Mock para desenvolvimento
      window.ipcAPI = {
        ping: async () => 'pong (mock)',
        getAppInfo: async () => ({ version: '0.1.0-dev', name: 'Laudo Pericial PCP' }),
        logInfo: (msg: string) => console.log(`[INFO] ${msg}`),
        logError: (msg: string, err?: any) => console.error(`[ERROR] ${msg}`, err),
        executeQuery: async () => ({ success: false, message: 'Mock mode' }),
        login: async () => ({ success: true, user: { id: 1, name: 'Usuário Mock' } }),
      };
    }

    // Testar conexão com main process
    if (isElectron) {
      try {
        const pingResult = await window.ipcAPI.ping();
        console.log('✅ Conexão com main process:', pingResult);
      } catch (error) {
        console.error('❌ Erro ao conectar com main process:', error);
      }
    }

    // Renderizar aplicação principal
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);

    // Mostrar tela de erro
    root.render(
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#f8f9fa',
          color: '#dc3545',
          textAlign: 'center',
          padding: '40px',
        }}
      >
        <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>❌ Erro ao Inicializar</h1>
        <p style={{ fontSize: '16px', marginBottom: '20px', maxWidth: '600px' }}>
          Ocorreu um erro ao inicializar a aplicação. Por favor, reinicie o aplicativo.
        </p>
        <pre
          style={{
            background: '#f1f3f5',
            padding: '15px',
            borderRadius: '8px',
            maxWidth: '600px',
            overflow: 'auto',
            textAlign: 'left',
            fontSize: '14px',
          }}
        >
          {error instanceof Error ? error.message : String(error)}
        </pre>
        {isElectron && (
          <button
            onClick={() => window.ipcAPI?.restartApp?.()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Reiniciar Aplicativo
          </button>
        )}
      </div>
    );
  }
};

// Inicializar aplicação
initApp();

// Hot Module Replacement (HMR)
if (import.meta.hot) {
  import.meta.hot.accept();
}
