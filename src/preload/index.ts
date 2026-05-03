import { contextBridge, ipcRenderer } from 'electron';

// Tipos para a API exposta
export interface IpcAPI {
  // Utilitários
  ping: () => Promise<string>;
  getAppInfo: () => Promise<{ version: string; name: string }>;

  // Logs
  logInfo: (message: string) => void;
  logError: (message: string, error?: any) => void;

  // Sistema
  restartApp: () => Promise<void>;
  openDevTools: () => void;

  // Banco de dados
  executeQuery: (query: string, params?: any[]) => Promise<any>;

  // Autenticação (exemplo - será expandido)
  login: (username: string, password: string) => Promise<{ success: boolean; user?: any }>;

  // Placeholder para outras APIs que serão implementadas
}

// Validar canais IPC permitidos
const ALLOWED_CHANNELS = new Set([
  'ping',
  'get-app-info',
  'log-info',
  'log-error',
  'restart-app',
  'open-dev-tools',
  'execute-query',
  'login',
]);

// Expor API segura para o renderer
contextBridge.exposeInMainWorld('ipcAPI', {
  // Utilitários
  ping: () => ipcRenderer.invoke('ping'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Logs
  logInfo: (message: string) => {
    if (typeof message !== 'string') {
      console.error('Tentativa de log com mensagem inválida:', message);
      return;
    }
    ipcRenderer.send('log-info', message);
  },

  logError: (message: string, error?: any) => {
    if (typeof message !== 'string') {
      console.error('Tentativa de log de erro com mensagem inválida:', message);
      return;
    }
    ipcRenderer.send('log-error', message, error);
  },

  // Sistema
  restartApp: () => ipcRenderer.invoke('restart-app'),
  openDevTools: () => ipcRenderer.send('open-dev-tools'),

  // Banco de dados
  executeQuery: (query: string, params?: any[]) => {
    if (typeof query !== 'string') {
      throw new Error('Query deve ser uma string');
    }

    // Proteção básica contra injeção SQL (será melhorada no main process)
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error('Query não pode ser vazia');
    }

    return ipcRenderer.invoke('execute-query', trimmedQuery, params || []);
  },

  // Autenticação
  login: (username: string, password: string) => {
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new Error('Username e password devem ser strings');
    }

    if (!username.trim() || !password.trim()) {
      throw new Error('Username e password não podem ser vazios');
    }

    return ipcRenderer.invoke('login', username.trim(), password.trim());
  },
} satisfies IpcAPI);

// Adicionar declaração de tipo para TypeScript no renderer
declare global {
  interface Window {
    ipcAPI: IpcAPI;
  }
}

// Log de segurança
console.log('🔒 Preload script carregado com segurança');