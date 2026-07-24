import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './styles/globals.css';
import type {
  AtualizarOrdemImagemLaudoEntrada,
  ImagemLaudoPersistida,
  SalvarImagemLaudoEntrada,
} from '@shared/types/imagem-laudo.types';
import type { RespostaAtualizacao } from '@shared/atualizacao/atualizacao.types';

// Mantem a fronteira IPC legada solta ate a tipagem por canal ser tratada em tranche propria.
type IpcDadoLegado = ReturnType<typeof JSON.parse>;

interface AppInfoLegado {
  version: string;
  name: string;
  platform: string;
  osVersion: string;
  arch: string;
  memory: string;
  dbVersion: number;
}

interface IpcRespostaLegada {
  success: boolean;
  data?: IpcDadoLegado;
  user?: IpcDadoLegado;
  error: string;
  message?: string;
  total?: number;
  count?: number;
  path?: string;
  valid?: boolean;
}

type IpcMetodoLegado = (...args: unknown[]) => Promise<IpcRespostaLegada>;

interface IpcGrupoLegado {
  [metodo: string]: IpcMetodoLegado;
}

interface IpcIlustracoesLegado {
  listarImagens: (laudoId: string) => Promise<{ success: boolean; data?: ImagemLaudoPersistida[]; error?: string }>;
  salvarImagem: (laudoId: string, imagem: SalvarImagemLaudoEntrada) => Promise<{ success: boolean; data?: ImagemLaudoPersistida; error?: string }>;
  excluirImagem: (laudoId: string, imagemId: string) => Promise<{ success: boolean; error?: string }>;
  arquivarImagem: (laudoId: string, imagemId: string) => Promise<{ success: boolean; error?: string }>;
  disponibilizarImagem: (laudoId: string, imagemId: string) => Promise<{ success: boolean; error?: string }>;
  atualizarLegenda: (laudoId: string, imagemId: string, legenda: string) => Promise<{ success: boolean; error?: string }>;
  atualizarOrdem: (laudoId: string, ordem: AtualizarOrdemImagemLaudoEntrada[]) => Promise<{ success: boolean; error?: string }>;
  openPanel: (laudoId: string, tituloLaudo?: string) => void;
  closePanel: () => void;
  syncToPanel: (data: Record<string, unknown>) => void;
  sendAction: (action: string, ...args: unknown[]) => void;
  onPanelAction: (cb: (action: string, ...args: unknown[]) => void) => () => void;
  onStateSync: <T>(cb: (data: T) => void) => () => void;
  onPanelClosed: (cb: () => void) => () => void;
}

interface IpcAPIRendererLegada {
  ping: () => Promise<string>;
  getAppInfo: () => Promise<AppInfoLegado>;
  logInfo: (module: string, message: string) => void | Promise<void>;
  logError: (module: string, message: string, error?: unknown) => void | Promise<void>;
  logWarning: (module: string, message: string) => void | Promise<void>;
  restartApp?: () => Promise<void>;
  closeApp: () => Promise<void>;
  openDevTools?: () => void;
  executeQuery: (...args: unknown[]) => Promise<IpcRespostaLegada>;
  login: (username: string, password: string) => Promise<IpcRespostaLegada>;
  verifyPassword: (userId: string, password: string) => Promise<IpcRespostaLegada>;
  user: IpcGrupoLegado;
  solicitante: IpcGrupoLegado;
  tipoExame: IpcGrupoLegado;
  rep: IpcGrupoLegado;
  dashboard: IpcGrupoLegado;
  configuracao: IpcGrupoLegado;
  gdl: IpcGrupoLegado;
  categoria: IpcGrupoLegado;
  placeholder: IpcGrupoLegado;
  template: IpcGrupoLegado;
  laudo: IpcGrupoLegado;
  wizard: IpcGrupoLegado;
  categoriaPeca: IpcGrupoLegado;
  peca: IpcGrupoLegado;
  regraWizard: IpcGrupoLegado;
  ia: IpcGrupoLegado;
  backup: IpcGrupoLegado;
  atualizacao?: {
    estado: () => Promise<RespostaAtualizacao>;
    verificar: () => Promise<RespostaAtualizacao>;
    baixar: () => Promise<RespostaAtualizacao>;
    adiar: () => Promise<RespostaAtualizacao>;
    prepararReinicio: () => Promise<RespostaAtualizacao>;
    instalarAgora: () => Promise<RespostaAtualizacao>;
    agendar: () => Promise<RespostaAtualizacao>;
    selecionarOffline: () => Promise<RespostaAtualizacao>;
    onSolicitarReinicio: (callback: () => boolean) => () => void;
  };
  log: IpcGrupoLegado;
  diagnosticoInterno: IpcGrupoLegado;
  ilustracoes: IpcIlustracoesLegado;
}

// Tipos globais para TypeScript
declare global {
  interface Window {
    ipcAPI: IpcAPIRendererLegada;
  }
}

const hasIpcApi = () =>
  typeof window !== 'undefined' &&
  typeof window.ipcAPI !== 'undefined' &&
  typeof window.ipcAPI?.ping === 'function';

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
    <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>laWdo</h1>
    <p style={{ fontSize: '16px', opacity: 0.8 }}>
      {hasIpcApi() ? 'Inicializando aplicacao...' : 'Aguardando conexao...'}
    </p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Funcao para inicializar a aplicacao
const initApp = async () => {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    console.error('Elemento root nao encontrado');
    return;
  }

  const root = ReactDOM.createRoot(rootElement);

  // Mostrar tela de carregamento inicial
  root.render(<LoadingScreen />);

  try {
    // Verificar se estamos no Electron
    if (!hasIpcApi()) {
      console.warn(
        'Nao esta no contexto do Electron. Algumas funcionalidades podem nao funcionar.'
      );

      // Mock para desenvolvimento
      window.ipcAPI = {
        ping: async () => 'pong (mock)',
        getAppInfo: async () => ({
          version: '0.1.0-dev',
          name: 'laWdo',
          platform: 'dev',
          osVersion: 'dev',
          arch: 'dev',
          memory: 'dev',
          dbVersion: 0,
        }),
        logInfo: async () => undefined,
        logError: (_module: string, msg: string, err?: unknown) => console.error(`[ERROR] ${msg}`, err),
        logWarning: (_module: string, msg: string) => console.warn(`[WARN] ${msg}`),
        verifyPassword: async () => ({ success: true, valid: true }),
        executeQuery: async () => ({ success: false, message: 'Mock mode' }),
        login: async () => ({ success: true, user: { id: 1, name: 'Usuario Mock', username: 'mock', email: 'mock@pcp.pr.gov.br', cargo: 'Perito Oficial Criminal', lotacao: 'Curitiba', foto_url: null } }),
        closeApp: async () => undefined,
        dashboard: {
          resumo: async () => ({ success: true, data: null }),
          projecoes: async () => ({ success: true, data: null }),
        },
        user: {
          findAll: async () => ({ success: true, data: [] }),
          findById: async () => ({ success: false, error: 'Mock mode' }),
          create: async () => ({ success: false, error: 'Mock mode' }),
          update: async () => ({ success: false, error: 'Mock mode' }),
          delete: async () => ({ success: false, error: 'Mock mode' }),
          findByEmail: async () => ({ success: false, error: 'Mock mode' }),
          findActivePeritos: async () => ({ success: true, data: [] }),
          updateProfile: async () => ({ success: false, error: 'Mock mode' }),
          uploadAvatar: async () => ({ success: true, data: { foto_url: '' } }),
          getAvatar: async () => ({ success: false, error: 'Mock mode' }),
        },
        solicitante: {
          findAll: async () => ({ success: true, data: [] }),
          findAllSemFiltroStatus: async () => ({ success: true, data: [] }),
          findById: async () => ({ success: false, error: 'Mock mode' }),
          create: async () => ({ success: false, error: 'Mock mode' }),
          update: async () => ({ success: false, error: 'Mock mode' }),
          delete: async () => ({ success: false, error: 'Mock mode' }),
          hardDelete: async () => ({ success: false, error: 'Mock mode' }),
          toggleStatus: async () => ({ success: false, error: 'Mock mode' }),
          findByTipo: async () => ({ success: true, data: [] }),
          findTipos: async () => ({ success: true, data: [] }),
          findAtivos: async () => ({ success: true, data: [] }),
        },
        log: {
          listar: async () => ({ success: true, data: [] }),
          limpar: async () => ({ success: true }),
          listarAuditoria: async () => ({ success: true, data: [], total: 0 }),
          limparAuditoria: async () => ({ success: true, count: 0 }),
          contar: async () => ({ success: true, data: { sistema: 0, auditoria: 0 } }),
        },
        laudo: {
          findAll: async () => ({ success: true, data: [] }),
          findByRepId: async () => ({ success: false, error: 'Mock mode' }),
          updateConteudo: async () => ({ success: false, error: 'Mock mode' }),
          create: async () => ({ success: false, error: 'Mock mode' }),
          delete: async () => ({ success: false, error: 'Mock mode' }),
          updateStatus: async () => ({ success: false, error: 'Mock mode' }),
        },
      } as unknown as IpcAPIRendererLegada;
    }

    // Testar conexao com main process
    if (hasIpcApi()) {
      try {
        await window.ipcAPI.ping();
      } catch (error) {
        console.error('Erro ao conectar com main process:', error);
      }
    }

    // Renderizar aplicacao principal
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Erro ao inicializar aplicacao:', error);

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
        <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Erro ao Inicializar</h1>
        <p style={{ fontSize: '16px', marginBottom: '20px', maxWidth: '600px' }}>
          Ocorreu um erro ao inicializar a aplicacao. Por favor, reinicie o aplicativo.
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
        {hasIpcApi() && (
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

// Inicializar aplicacao
initApp();

// Hot Module Replacement (HMR)
if (import.meta.hot) {
  import.meta.hot.accept();
}
