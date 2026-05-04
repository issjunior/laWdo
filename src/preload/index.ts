import { contextBridge, ipcRenderer } from 'electron';
import type {
  UserFilters,
  PaginationOptions,
  UserCreateData,
  UserUpdateData,
  UserProfileUpdateData,
  UserResponse,
  PaginatedUserResponse,
  SolicitanteFilters,
  SolicitanteCreateData,
  SolicitanteUpdateData,
  TipoExameCreateData,
  TipoExameUpdateData
} from './types';

// Tipos para a API exposta
export interface IpcAPI {
  // Utilitários
  ping: () => Promise<string>;
  getAppInfo: () => Promise<{ version: string; name: string }>;

  // Logs
  logInfo: (message: string) => void;
  logError: (message: string, error?: any) => void;
  logWarning: (message: string) => void;

  // Sistema
  restartApp: () => Promise<void>;
  openDevTools: () => void;

  // Banco de dados
  executeQuery: (query: string, params?: any[]) => Promise<any>;

  // Autenticação (exemplo - será expandido)
  login: (username: string, password: string) => Promise<{ success: boolean; user?: any }>;

  // Usuários
  user: {
    findAll: (filters?: UserFilters, options?: PaginationOptions) => Promise<PaginatedUserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    create: (userData: UserCreateData) => Promise<UserResponse>;
    update: (id: string, updateData: UserUpdateData) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
    findByEmail: (email: string) => Promise<UserResponse>;
    findActivePeritos: () => Promise<UserResponse>;
    updateProfile: (userId: string, profileData: UserProfileUpdateData) => Promise<UserResponse>;
  };

  // Solicitantes
  solicitante: {
    findAll: (filters?: SolicitanteFilters, options?: PaginationOptions) => Promise<UserResponse>;
    findAllSemFiltroStatus: (filters?: SolicitanteFilters, options?: PaginationOptions) => Promise<UserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    create: (solicitanteData: SolicitanteCreateData) => Promise<UserResponse>;
    update: (id: string, updateData: SolicitanteUpdateData) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
    hardDelete: (id: string) => Promise<UserResponse>;
    toggleStatus: (id: string) => Promise<UserResponse>;
    findByTipo: (tipo: string) => Promise<UserResponse>;
    findTipos: () => Promise<UserResponse>;
    findAtivos: (filters?: { tipo?: string }, options?: PaginationOptions) => Promise<UserResponse>;
  };

  // Tipos de Exame
  tipoExame: {
    findAll: () => Promise<UserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    create: (tipoExameData: TipoExameCreateData) => Promise<UserResponse>;
    update: (id: string, updateData: TipoExameUpdateData) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
    findComTemplate: () => Promise<UserResponse>;
    atualizarTemplate: (id: string, template: string) => Promise<UserResponse>;
    obterTemplate: (id: string) => Promise<UserResponse>;
  };

  // Placeholder para outras APIs que serão implementadas
}

// Validar canais IPC permitidos
const ALLOWED_CHANNELS = new Set([
  // Utilitários
  'ping',
  'get-app-info',

  // Logs
  'log-info',
  'log-error',
  'log-warning',

  // Sistema
  'restart-app',
  'open-dev-tools',

  // Banco de dados
  'execute-query',

  // Autenticação
  'login',

  // Usuários
  'user:findAll',
  'user:findById',
  'user:create',
  'user:update',
  'user:delete',
  'user:findByEmail',
  'user:findActivePeritos',
  'user:updateProfile',

  // Solicitantes
  'solicitante:findAll',
  'solicitante:findAllSemFiltroStatus',
  'solicitante:findById',
  'solicitante:create',
  'solicitante:update',
  'solicitante:delete',
  'solicitante:hardDelete',
  'solicitante:toggleStatus',
  'solicitante:findByTipo',
  'solicitante:findTipos',
  'solicitante:findAtivos',

  // Tipos de Exame
  'tipo-exame:findAll',
  'tipo-exame:findById',
  'tipo-exame:create',
  'tipo-exame:update',
  'tipo-exame:delete',
  'tipo-exame:findComTemplate',
  'tipo-exame:atualizarTemplate',
  'tipo-exame:obterTemplate',
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

  logWarning: (message: string) => {
    if (typeof message !== 'string') {
      console.error('Tentativa de log de warning com mensagem inválida:', message);
      return;
    }
    ipcRenderer.send('log-warning', message);
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

  // Usuários
  user: {
    findAll: (filters = {}, options = {}) => {
      return ipcRenderer.invoke('user:findAll', filters, options);
    },

    findById: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('user:findById', id.trim());
    },

    create: (userData: UserCreateData) => {
      if (!userData || typeof userData !== 'object') {
        throw new Error('Dados do usuário inválidos');
      }
      if (!userData.nome || !userData.email) {
        throw new Error('Nome e email são obrigatórios');
      }
      return ipcRenderer.invoke('user:create', userData);
    },

    update: (id: string, updateData: UserUpdateData) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      if (!updateData || typeof updateData !== 'object') {
        throw new Error('Dados de atualização inválidos');
      }
      return ipcRenderer.invoke('user:update', id.trim(), updateData);
    },

    delete: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('user:delete', id.trim());
    },

    findByEmail: (email: string) => {
      if (typeof email !== 'string' || !email.trim()) {
        throw new Error('Email inválido');
      }
      return ipcRenderer.invoke('user:findByEmail', email.trim());
    },

    findActivePeritos: () => {
      return ipcRenderer.invoke('user:findActivePeritos');
    },

    updateProfile: (userId: string, profileData: UserProfileUpdateData) => {
      if (typeof userId !== 'string' || !userId.trim()) {
        throw new Error('ID do usuário inválido');
      }
      if (!profileData || typeof profileData !== 'object') {
        throw new Error('Dados do perfil inválidos');
      }
      return ipcRenderer.invoke('user:updateProfile', userId.trim(), profileData);
    },
  },

  // Solicitantes
  solicitante: {
    findAll: (filters?: SolicitanteFilters, options?: PaginationOptions) => {
      return ipcRenderer.invoke('solicitante:findAll', filters, options);
    },

    findAllSemFiltroStatus: (filters?: SolicitanteFilters, options?: PaginationOptions) => {
      return ipcRenderer.invoke('solicitante:findAllSemFiltroStatus', filters, options);
    },

    findById: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('solicitante:findById', id.trim());
    },

    create: (solicitanteData: SolicitanteCreateData) => {
      if (!solicitanteData || typeof solicitanteData !== 'object') {
        throw new Error('Dados do solicitante inválidos');
      }
      if (!solicitanteData.nome || !solicitanteData.tipo) {
        throw new Error('Nome e tipo são obrigatórios');
      }
      return ipcRenderer.invoke('solicitante:create', solicitanteData);
    },

    update: (id: string, updateData: SolicitanteUpdateData) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      if (!updateData || typeof updateData !== 'object') {
        throw new Error('Dados de atualização inválidos');
      }
      return ipcRenderer.invoke('solicitante:update', id.trim(), updateData);
    },

    delete: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('solicitante:delete', id.trim());
    },

    hardDelete: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('solicitante:hardDelete', id.trim());
    },

    toggleStatus: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('solicitante:toggleStatus', id.trim());
    },

    findByTipo: (tipo: string) => {
      if (typeof tipo !== 'string' || !tipo.trim()) {
        throw new Error('Tipo inválido');
      }
      return ipcRenderer.invoke('solicitante:findByTipo', tipo.trim());
    },

    findTipos: () => {
      return ipcRenderer.invoke('solicitante:findTipos');
    },

    findAtivos: (filters = {}, options = {}) => {
      return ipcRenderer.invoke('solicitante:findAtivos', filters, options);
    },
  },

  // Tipos de Exame
  tipoExame: {
    findAll: () => {
      return ipcRenderer.invoke('tipo-exame:findAll');
    },

    findById: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('tipo-exame:findById', id.trim());
    },

    create: (tipoExameData: TipoExameCreateData) => {
      if (!tipoExameData || typeof tipoExameData !== 'object') {
        throw new Error('Dados do tipo de exame inválidos');
      }
      if (!tipoExameData.nome) {
        throw new Error('Nome é obrigatório');
      }
      return ipcRenderer.invoke('tipo-exame:create', tipoExameData);
    },

    update: (id: string, updateData: TipoExameUpdateData) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      if (!updateData || typeof updateData !== 'object') {
        throw new Error('Dados de atualização inválidos');
      }
      return ipcRenderer.invoke('tipo-exame:update', id.trim(), updateData);
    },

    delete: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('tipo-exame:delete', id.trim());
    },

    findComTemplate: () => {
      return ipcRenderer.invoke('tipo-exame:findComTemplate');
    },

    atualizarTemplate: (id: string, template: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      if (typeof template !== 'string') {
        throw new Error('Template inválido');
      }
      return ipcRenderer.invoke('tipo-exame:atualizarTemplate', id.trim(), template);
    },

    obterTemplate: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('tipo-exame:obterTemplate', id.trim());
    },
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
