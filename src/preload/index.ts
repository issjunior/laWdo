import { contextBridge, ipcRenderer } from 'electron';
import type {
  DashboardResponse,
  UserFilters,
  PaginationOptions,
  UserCreateData,
  UserUpdateData,
  UserProfileUpdateData,
  UserResponse,
  PaginatedUserResponse,
  UserAvatarResponse,
  SolicitanteFilters,
  SolicitanteCreateData,
  SolicitanteUpdateData,
  TipoExameCreateData,
  TipoExameUpdateData
} from './types.js';
import type { DashboardProjecoes, DashboardResumo } from '../types/dashboard.js';
import type { DadosImportacaoB602, ResultadoImportacaoExame } from '../shared/types/b602-gdl.types.js';
import type { ArquivoRepGdl, ResultadoCapturaImagensRepGdl } from '../shared/types/gdl-arquivos.types.js';
import type {
  AtualizarOrdemImagemLaudoEntrada,
  ImagemLaudoPersistida,
  SalvarImagemLaudoEntrada,
} from '../shared/types/imagem-laudo.types.js';
import type { RespostaAtualizacao } from '../shared/atualizacao/atualizacao.types.js';

// Tipo para entrada de log do sistema
interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
}

type IpcPayload = unknown;
type IpcParams = unknown[];
type IpcResult = unknown;
type ImportarArquivoResponse = { success: boolean; data?: IpcPayload; error?: string };
type BackupResponse = { success: boolean; path?: string; error?: string };
type ListaAuditoriaResponse = { success: boolean; data?: IpcPayload[]; total?: number; error?: string };
type TimelineResponse = { success: boolean; data?: IpcPayload[]; error?: string };
type ExportacaoLaudoParams = {
  laudoId: string;
  formato: 'pdf' | 'docx' | 'odt';
  html: string;
  estrutura?: IpcPayload;
  cabecalho?: IpcPayload;
  margens?: IpcPayload;
};

// Tipos para a API exposta
export interface IpcAPI {
  // Utilitários
  ping: () => Promise<string>;
  getAppInfo: () => Promise<{
    version: string;
    name: string;
    platform: string;
    osVersion: string;
    arch: string;
    memory: string;
    dbVersion: number;
  }>;

  // Logs
  logInfo: (module: string, message: string) => void;
  logError: (module: string, message: string, error?: IpcPayload) => void;
  logWarning: (module: string, message: string) => void;

  // Sistema
  restartApp: () => Promise<void>;
  closeApp: () => Promise<void>;
  openDevTools: () => void;

  // Banco de dados
  executeQuery: (query: string, params?: IpcParams) => Promise<IpcResult>;

  // Autenticação
  login: (username: string, password: string) => Promise<{ success: boolean; user?: IpcPayload }>;
  verifyPassword: (userId: string, password: string) => Promise<{ success: boolean; valid: boolean; error?: string }>;

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
    uploadAvatar: (userId: string, base64Data: string) => Promise<UserAvatarResponse>;
    getAvatar: (userId: string) => Promise<UserAvatarResponse>;
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
    toggleStatus: (id: string) => Promise<UserResponse>;
    findAllSemFiltroStatus: () => Promise<UserResponse>;
  };

  // REPs
  rep: {
    findAll: () => Promise<UserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    findByNumero: (numero: string) => Promise<UserResponse>;
    create: (data: IpcPayload) => Promise<UserResponse>;
    update: (id: string, data: IpcPayload) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
    updateStatus: (id: string, status: string) => Promise<UserResponse>;
  };

  dashboard: {
    resumo: () => Promise<DashboardResponse<DashboardResumo>>;
    projecoes: () => Promise<DashboardResponse<DashboardProjecoes>>;
  };

  // Configurações
  configuracao: {
    obter: (chave: string) => Promise<UserResponse>;
    salvar: (chave: string, valor: string, tipo?: string, descricao?: string) => Promise<UserResponse>;
  };

  // GDL
  gdl: {
    testarConexao: (ambiente?: string) => Promise<UserResponse>;
    obterValidacaoSessao: (ambiente?: string) => Promise<UserResponse>;
    limparValidacaoSessao: (ambiente?: string) => Promise<UserResponse>;
    validarCredenciais: (ambiente: string, credenciais: { login: string; senha: string; cpfUsuario?: string }, numero: string, ano: string) => Promise<UserResponse>;
    consultarRep: (numero: string, ano: string) => Promise<UserResponse<ResultadoImportacaoExame<DadosImportacaoB602>>>;
    listarImagensLaudo: (laudoId: string) => Promise<UserResponse<ArquivoRepGdl[]>>;
    capturarImagensLaudo: (laudoId: string, idsSelecao: string[]) => Promise<UserResponse<ResultadoCapturaImagensRepGdl>>;
  };

  // Placeholder para outras APIs que serão implementadas

  // Placeholders
  categoria: {
    findAll: () => Promise<UserResponse>;
    findArvore: () => Promise<UserResponse>;
    create: (data: IpcPayload) => Promise<UserResponse>;
    update: (id: string, data: IpcPayload) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
  };

  placeholder: {
    findAll: () => Promise<UserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    create: (data: IpcPayload) => Promise<UserResponse>;
    update: (id: string, data: IpcPayload) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
    seedSistema: () => Promise<UserResponse>;
    migrateSistema: () => Promise<UserResponse>;
  };

  // Templates
  template: {
    findAll: () => Promise<UserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    findByTipoExame: (tipoExameId: string) => Promise<UserResponse>;
    create: (data: IpcPayload) => Promise<UserResponse>;
    update: (id: string, data: IpcPayload) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
    findSecoes: (templateId: string) => Promise<UserResponse>;
    createSecao: (data: IpcPayload) => Promise<UserResponse>;
    updateSecao: (id: string, data: IpcPayload) => Promise<UserResponse>;
    deleteSecao: (id: string) => Promise<UserResponse>;
    reordenarSecoes: (templateId: string, idsOrdenados: string[]) => Promise<UserResponse>;
    previewPDF: (html: string, margins?: { top: number; right: number; bottom: number; left: number }, headerTemplate?: string) => Promise<UserResponse>;
    importarArquivo: () => Promise<ImportarArquivoResponse>;
  };

  // Laudos
  laudo: {
    findAll: () => Promise<UserResponse>;
    findAllByRepId: (repId: string) => Promise<UserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    findByRepId: (repId: string) => Promise<UserResponse>;
    updateConteudo: (laudoId: string, conteudo: string) => Promise<UserResponse>;
    create: (data: { rep_id: string; perito_id: string; template_id: string }) => Promise<UserResponse>;
    delete: (laudoId: string, userId?: string) => Promise<UserResponse>;
    updateStatus: (laudoId: string, status: string) => Promise<UserResponse>;
    gerarWizard: (params: IpcPayload) => Promise<UserResponse>;
    salvarProgressoWizard: (laudoId: string, respostas: IpcPayload) => Promise<UserResponse>;
    getRespostasWizard: (laudoId: string) => Promise<UserResponse>;
    exportar: (params: ExportacaoLaudoParams) => Promise<UserResponse>;
    verificarLibreOffice: () => Promise<UserResponse>;
    sincronizarSecoes: (laudoId: string) => Promise<UserResponse>;
  };

  // Wizard
  wizard: {
    findAll: () => Promise<UserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    findByTipoExame: (tipoExameId: string) => Promise<UserResponse>;
    create: (data: IpcPayload) => Promise<UserResponse>;
    update: (id: string, data: IpcPayload) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
    getArvore: (wizardId: string) => Promise<UserResponse>;
    saveArvore: (wizardId: string, arvore: IpcPayload) => Promise<UserResponse>;
  };

  // Peças (Banco de Peças)
  categoriaPeca: {
    findAll: () => Promise<UserResponse>;
    findArvore: () => Promise<UserResponse>;
    create: (data: IpcPayload) => Promise<UserResponse>;
    update: (id: string, data: IpcPayload) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
  };

  peca: {
    findAll: () => Promise<UserResponse>;
    findById: (id: string) => Promise<UserResponse>;
    create: (data: IpcPayload) => Promise<UserResponse>;
    update: (id: string, data: IpcPayload) => Promise<UserResponse>;
    delete: (id: string) => Promise<UserResponse>;
    search: (query: string) => Promise<UserResponse>;
    findByCategoria: (categoriaId: string) => Promise<UserResponse>;
    findByCategoriaRecursiva: (categoriaId: string) => Promise<UserResponse>;
  };

  // Regras do Wizard
  regraWizard: {
    findByWizard: (wizardId: string) => Promise<UserResponse>;
    save: (regras: IpcPayload[]) => Promise<UserResponse>;
    calcularPecas: (wizardId: string, respostas: IpcPayload) => Promise<UserResponse>;
  };

  // IA / Integração Groq
  ia: {
    revisarOrtografia: (textoHtml: string) => Promise<UserResponse>;
    adequarEscrita: (textoHtml: string) => Promise<UserResponse>;
    descreverImagem: (imagens: Array<{ src: string; alt?: string }>) => Promise<UserResponse>;
    perguntar: (pergunta: string, contexto?: string) => Promise<UserResponse>;
  };

  // Backup e Restauração
  backup: {
    criar: () => Promise<BackupResponse>;
    restaurar: () => Promise<Omit<BackupResponse, 'path'>>;
    configExportar: () => Promise<BackupResponse>;
    configImportar: () => Promise<Omit<BackupResponse, 'path'>>;
  };

  atualizacao: {
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

  // Logs do sistema
  log: {
    listar: (filters?: Record<string, unknown>) => Promise<{ success: boolean; data?: LogEntry[]; error?: string }>;
    limpar: () => Promise<{ success: boolean; error?: string }>;
    listarAuditoria: (filters?: Record<string, unknown>) => Promise<ListaAuditoriaResponse>;
    limparAuditoria: (userId?: string) => Promise<{ success: boolean; count?: number; error?: string }>;
    contar: () => Promise<{ success: boolean; data?: { sistema: number; auditoria: number }; error?: string }>;
    timelineRep: (repId: string) => Promise<TimelineResponse>;
  };

  diagnosticoInterno: {
    atualizarContextoRenderer: (contexto: Record<string, unknown>) => void;
    registrarErroFatalRenderer: (erro: Record<string, unknown>) => void;
  };

  // Painel de Ilustrações (janela separada)
  ilustracoes: {
    listarImagens: (laudoId: string) => Promise<{ success: boolean; data?: ImagemLaudoPersistida[]; error?: string }>;
    salvarImagem: (laudoId: string, imagem: SalvarImagemLaudoEntrada) => Promise<{ success: boolean; data?: ImagemLaudoPersistida; error?: string }>;
      excluirImagem: (laudoId: string, imagemId: string) => Promise<{ success: boolean; error?: string }>;
      arquivarImagem: (laudoId: string, imagemId: string) => Promise<{ success: boolean; error?: string }>;
      disponibilizarImagem: (laudoId: string, imagemId: string) => Promise<{ success: boolean; error?: string }>;
    atualizarLegenda: (laudoId: string, imagemId: string, legenda: string) => Promise<{ success: boolean; error?: string }>;
    atualizarOrdem: (laudoId: string, ordem: AtualizarOrdemImagemLaudoEntrada[]) => Promise<{ success: boolean; error?: string }>;
    openPanel: (laudoId: string, tituloLaudo?: string) => void;
    closePanel: () => void;
    syncToPanel: (data: { figurasNoEditor: unknown[]; syncEnabled: boolean; figuraAtivaId: string | null }) => void;
    sendAction: (action: string, ...args: unknown[]) => void;
    onPanelAction: (cb: (action: string, ...args: unknown[]) => void) => () => void;
    onStateSync: (cb: (data: { figurasNoEditor: unknown[]; syncEnabled: boolean; figuraAtivaId: string | null }) => void) => () => void;
    onPanelClosed: (cb: () => void) => () => void;
  };
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
  'log-batch',

  // Sistema
  'restart-app',
  'close-app',
  'open-dev-tools',

  // Banco de dados
  'execute-query',

  // Autenticação
  'login',
  'user:verifyPassword',

  // Usuários
  'user:findAll',
  'user:findById',
  'user:create',
  'user:update',
  'user:delete',
  'user:findByEmail',
  'user:findActivePeritos',
  'user:updateProfile',
  'user:uploadAvatar',
  'user:getAvatar',

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
  'tipo-exame:toggleStatus',
  'tipo-exame:findAllSemFiltroStatus',
  'configuracao:obter',
  'configuracao:salvar',

  // GDL
  'gdl:testar-conexao',
  'gdl:obter-validacao-sessao',
  'gdl:limpar-validacao-sessao',
  'gdl:validar-credenciais',
  'gdl:consultar-rep',
  'gdl:listar-imagens-laudo',
  'gdl:capturar-imagens-laudo',
  'rep:create',
  'rep:findAll',
  'rep:findById',
  'rep:findByNumero',
  'rep:update',
  'rep:delete',
  'rep:updateStatus',
  'dashboard:resumo',
  'dashboard:projecoes',

  // Categorias de Placeholders
  'categoria:findAll',
  'categoria:findArvore',
  'categoria:create',
  'categoria:update',
  'categoria:delete',

  // Placeholders
  'placeholder:findAll',
  'placeholder:findById',
  'placeholder:create',
  'placeholder:update',
  'placeholder:delete',
  'placeholder:migrateSistema',
  'placeholder:seedSistema',

  // Templates
  'template:findAll',
  'template:findById',
  'template:findByTipoExame',
  'template:create',
  'template:update',
  'template:delete',
  'template:findSecoes',
  'template:createSecao',
  'template:updateSecao',
  'template:deleteSecao',
  'template:reordenarSecoes',
  'template:previewPDF',
  'template:importarArquivo',

  // Laudos
  'laudo:findById',
  'laudo:findByRepId',
  'laudo:findAllByRepId',
  'laudo:findAll',
  'laudo:updateConteudo',
  'laudo:create',
  'laudo:delete',
  'laudo:updateStatus',
  'laudo:gerarWizard',
  'laudo:salvarProgressoWizard',
  'laudo:getRespostasWizard',
  'laudo:exportar',
  'laudo:verificarLibreOffice',
  'laudo:sincronizarSecoes',

  // Wizards
  'wizard:findAll',
  'wizard:findById',
  'wizard:findByTipoExame',
  'wizard:create',
  'wizard:update',
  'wizard:delete',
  'wizard:getArvore',
  'wizard:saveArvore',

  // Peças
  'peca:findAll',
  'peca:findById',
  'peca:create',
  'peca:update',
  'peca:delete',
  'peca:search',
  'peca:findByCategoria',
  'peca:findByCategoriaRecursiva',

  // Categorias de Peças
  'categoria-peca:findAll',
  'categoria-peca:findArvore',
  'categoria-peca:create',
  'categoria-peca:update',
  'categoria-peca:delete',

  // Regras Wizard
  'regra-wizard:findByWizard',
  'regra-wizard:save',
  'regra-wizard:calcularPecas',

  // IA
  'ia:revisarOrtografia',
  'ia:adequarEscrita',
  'ia:descreverImagem',
  'ia:perguntar',

  // Backup
  'backup:criar',
  'backup:restaurar',
  'backup:config-exportar',
  'backup:config-importar',

  // Atualização
  'atualizacao:estado',
  'atualizacao:verificar',
  'atualizacao:baixar',
  'atualizacao:adiar',
  'atualizacao:preparar-reinicio',
  'atualizacao:instalar-agora',
  'atualizacao:agendar',
  'atualizacao:selecionar-offline',
  'atualizacao:responder-reinicio',

  // Logs do sistema
  'log:listar',
  'log:limpar',
  'log:listar-auditoria',
  'log:limpar-auditoria',
  'log:contar',
  'log:timeline-rep',

  // Diagnóstico interno
  'diagnostico:atualizar-contexto-renderer',
  'diagnostico:erro-fatal-renderer',

  // Painel de Ilustrações
  'ilustracoes:open-panel',
  'ilustracoes:listar-imagens',
  'ilustracoes:salvar-imagem',
    'ilustracoes:excluir-imagem',
    'ilustracoes:arquivar-imagem',
    'ilustracoes:disponibilizar-imagem',
  'ilustracoes:atualizar-legenda',
  'ilustracoes:atualizar-ordem',
  'ilustracoes:close-panel',
  'ilustracoes:sync-to-panel',
  'ilustracoes:panel-action',
  'ilustracoes:state-sync',
  'ilustracoes:panel-closed',
]);

const validarCanal = (channel: string): void => {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`Canal IPC não permitido: ${channel}`);
  }
};

const invokeSeguro = <T = IpcResult>(channel: string, ...args: IpcParams): Promise<T> => {
  validarCanal(channel);
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
};

const sendSeguro = (channel: string, ...args: IpcParams): void => {
  validarCanal(channel);
  ipcRenderer.send(channel, ...args);
};

// Expor API segura para o renderer
contextBridge.exposeInMainWorld('ipcAPI', {
  // Utilitários
  ping: () => invokeSeguro<string>('ping'),
  getAppInfo: () => invokeSeguro('get-app-info'),

  // Logs
  logInfo: (module: string, message: string) => {
    if (typeof message !== 'string') {
      console.error('Tentativa de log com mensagem inválida:', message);
      return;
    }
    sendSeguro('log-info', module, message);
  },

  logError: (module: string, message: string, error?: IpcPayload) => {
    if (typeof message !== 'string') {
      console.error('Tentativa de log de erro com mensagem inválida:', message);
      return;
    }
    sendSeguro('log-error', module, message, error);
  },

  logWarning: (module: string, message: string) => {
    if (typeof message !== 'string') {
      console.error('Tentativa de log de warning com mensagem inválida:', message);
      return;
    }
    sendSeguro('log-warning', module, message);
  },

  // Sistema
  restartApp: () => invokeSeguro<void>('restart-app'),
  closeApp: () => invokeSeguro<void>('close-app'),
  openDevTools: () => sendSeguro('open-dev-tools'),

  // Banco de dados
  executeQuery: (query: string, params?: IpcParams) => {
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

  verifyPassword: (userId: string, password: string) => {
    if (typeof userId !== 'string' || typeof password !== 'string') return Promise.resolve({ success: false, valid: false, error: 'Dados inválidos' });
    return ipcRenderer.invoke('user:verifyPassword', userId, password);
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

    uploadAvatar: (userId: string, base64Data: string) => {
      if (typeof userId !== 'string' || !userId.trim()) {
        throw new Error('ID do usuário inválido');
      }
      if (typeof base64Data !== 'string' || !base64Data) {
        throw new Error('Dados da imagem inválidos');
      }
      return ipcRenderer.invoke('user:uploadAvatar', userId.trim(), base64Data);
    },

    getAvatar: (userId: string) => {
      if (typeof userId !== 'string' || !userId.trim()) {
        throw new Error('ID do usuário inválido');
      }
      return ipcRenderer.invoke('user:getAvatar', userId.trim());
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
      if (!solicitanteData.nome) {
        throw new Error('Nome é obrigatório');
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
      if (!tipoExameData.codigo) {
        throw new Error('Código é obrigatório');
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

    toggleStatus: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return ipcRenderer.invoke('tipo-exame:toggleStatus', id.trim());
    },

    findAllSemFiltroStatus: () => {
      return ipcRenderer.invoke('tipo-exame:findAllSemFiltroStatus');
    },
  },

  configuracao: {
    obter: (chave: string) => {
      if (typeof chave !== 'string' || !chave.trim()) {
        throw new Error('Chave inválida');
      }
      return ipcRenderer.invoke('configuracao:obter', chave.trim());
    },
    salvar: (chave: string, valor: string, tipo?: string, descricao?: string) => {
      if (typeof chave !== 'string' || !chave.trim()) {
        throw new Error('Chave inválida');
      }
      return ipcRenderer.invoke('configuracao:salvar', chave.trim(), valor, tipo, descricao);
    },
  },

  gdl: {
    testarConexao: (ambiente?: string) => ipcRenderer.invoke('gdl:testar-conexao', ambiente),
    obterValidacaoSessao: (ambiente?: string) => ipcRenderer.invoke('gdl:obter-validacao-sessao', ambiente),
    limparValidacaoSessao: (ambiente?: string) => ipcRenderer.invoke('gdl:limpar-validacao-sessao', ambiente),
    validarCredenciais: (ambiente: string, credenciais: { login: string; senha: string; cpfUsuario?: string }, numero: string, ano: string) => {
      if (typeof ambiente !== 'string' || !ambiente.trim()) {
        throw new Error('Ambiente GDL é obrigatório');
      }
      if (typeof numero !== 'string' || !numero.trim()) {
        throw new Error('Número da REP é obrigatório');
      }
      if (typeof ano !== 'string' || !ano.trim()) {
        throw new Error('Ano da REP é obrigatório');
      }
      return ipcRenderer.invoke('gdl:validar-credenciais', ambiente.trim(), credenciais, numero.trim(), ano.trim());
    },
    consultarRep: (numero: string, ano: string) => {
      if (typeof numero !== 'string' || !numero.trim()) {
        throw new Error('Número da REP é obrigatório');
      }
      if (typeof ano !== 'string' || !ano.trim()) {
        throw new Error('Ano da REP é obrigatório');
      }
      return ipcRenderer.invoke('gdl:consultar-rep', numero.trim(), ano.trim());
    },
    listarImagensLaudo: (laudoId: string) => {
      if (typeof laudoId !== 'string' || !laudoId.trim()) throw new Error('Laudo inválido');
      return ipcRenderer.invoke('gdl:listar-imagens-laudo', laudoId);
    },
    capturarImagensLaudo: (laudoId: string, idsSelecao: string[]) => {
      if (typeof laudoId !== 'string' || !laudoId.trim()) throw new Error('Laudo inválido');
      if (!Array.isArray(idsSelecao) || idsSelecao.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) {
        throw new Error('Seleção de imagens inválida');
      }
      return ipcRenderer.invoke('gdl:capturar-imagens-laudo', laudoId, idsSelecao);
    },
  },

  rep: {
    findAll: () => ipcRenderer.invoke('rep:findAll'),
    findById: (id: string) => ipcRenderer.invoke('rep:findById', id),
    findByNumero: (numero: string) => ipcRenderer.invoke('rep:findByNumero', numero),
    create: (data: IpcPayload) => ipcRenderer.invoke('rep:create', data),
    update: (id: string, data: IpcPayload) => ipcRenderer.invoke('rep:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('rep:delete', id),
    updateStatus: (id: string, status: string) => ipcRenderer.invoke('rep:updateStatus', id, status),
  },

  dashboard: {
    resumo: () => ipcRenderer.invoke('dashboard:resumo'),
    projecoes: () => ipcRenderer.invoke('dashboard:projecoes'),
  },

  categoria: {
    findAll: () => ipcRenderer.invoke('categoria:findAll'),
    findArvore: () => ipcRenderer.invoke('categoria:findArvore'),
    create: (data: IpcPayload) => ipcRenderer.invoke('categoria:create', data),
    update: (id: string, data: IpcPayload) => ipcRenderer.invoke('categoria:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('categoria:delete', id),
  },

  placeholder: {
    findAll: () => ipcRenderer.invoke('placeholder:findAll'),
    findById: (id: string) => ipcRenderer.invoke('placeholder:findById', id),
    create: (data: IpcPayload) => ipcRenderer.invoke('placeholder:create', data),
    update: (id: string, data: IpcPayload) => ipcRenderer.invoke('placeholder:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('placeholder:delete', id),
    migrateSistema: () => ipcRenderer.invoke('placeholder:migrateSistema'),
    seedSistema: () => ipcRenderer.invoke('placeholder:seedSistema'),
  },

  template: {
    findAll: () => ipcRenderer.invoke('template:findAll'),
    findById: (id: string) => ipcRenderer.invoke('template:findById', id),
    findByTipoExame: (tipoExameId: string) => ipcRenderer.invoke('template:findByTipoExame', tipoExameId),
    create: (data: IpcPayload) => ipcRenderer.invoke('template:create', data),
    update: (id: string, data: IpcPayload) => ipcRenderer.invoke('template:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('template:delete', id),
    findSecoes: (templateId: string) => ipcRenderer.invoke('template:findSecoes', templateId),
    createSecao: (data: IpcPayload) => ipcRenderer.invoke('template:createSecao', data),
    updateSecao: (id: string, data: IpcPayload) => ipcRenderer.invoke('template:updateSecao', id, data),
    deleteSecao: (id: string) => ipcRenderer.invoke('template:deleteSecao', id),
    reordenarSecoes: (templateId: string, idsOrdenados: string[]) => ipcRenderer.invoke('template:reordenarSecoes', templateId, idsOrdenados),
    previewPDF: (html: string, margins?: { top: number; right: number; bottom: number; left: number }, headerTemplate?: string) => ipcRenderer.invoke('template:previewPDF', { html, margins, headerTemplate }),
    importarArquivo: () => ipcRenderer.invoke('template:importarArquivo'),
  },

  laudo: {
    findAll: () => ipcRenderer.invoke('laudo:findAll'),
    findAllByRepId: (repId: string) => ipcRenderer.invoke('laudo:findAllByRepId', repId),
    findById: (id: string) => ipcRenderer.invoke('laudo:findById', id),
    findByRepId: (repId: string) => ipcRenderer.invoke('laudo:findByRepId', repId),
    updateConteudo: (laudoId: string, conteudo: string) => ipcRenderer.invoke('laudo:updateConteudo', laudoId, conteudo),
    create: (data: { rep_id: string; perito_id: string; template_id: string }) => ipcRenderer.invoke('laudo:create', data),
    delete: (laudoId: string, userId?: string) => ipcRenderer.invoke('laudo:delete', laudoId, userId),
    updateStatus: (laudoId: string, status: string) => ipcRenderer.invoke('laudo:updateStatus', laudoId, status),
    gerarWizard: (params: IpcPayload) => ipcRenderer.invoke('laudo:gerarWizard', params),
    salvarProgressoWizard: (laudoId: string, respostas: IpcPayload) => ipcRenderer.invoke('laudo:salvarProgressoWizard', laudoId, respostas),
    getRespostasWizard: (laudoId: string) => ipcRenderer.invoke('laudo:getRespostasWizard', laudoId),
    exportar: (params: ExportacaoLaudoParams) => ipcRenderer.invoke('laudo:exportar', params),
    verificarLibreOffice: () => ipcRenderer.invoke('laudo:verificarLibreOffice'),
    sincronizarSecoes: (laudoId: string) => ipcRenderer.invoke('laudo:sincronizarSecoes', laudoId),
  },

  wizard: {
    findAll: () => ipcRenderer.invoke('wizard:findAll'),
    findById: (id: string) => ipcRenderer.invoke('wizard:findById', id),
    findByTipoExame: (tipoExameId: string) => ipcRenderer.invoke('wizard:findByTipoExame', tipoExameId),
    create: (data: IpcPayload) => ipcRenderer.invoke('wizard:create', data),
    update: (id: string, data: IpcPayload) => ipcRenderer.invoke('wizard:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('wizard:delete', id),
    getArvore: (wizardId: string) => ipcRenderer.invoke('wizard:getArvore', wizardId),
    saveArvore: (wizardId: string, arvore: IpcPayload) => ipcRenderer.invoke('wizard:saveArvore', wizardId, arvore),
  },

  categoriaPeca: {
    findAll: () => ipcRenderer.invoke('categoria-peca:findAll'),
    findArvore: () => ipcRenderer.invoke('categoria-peca:findArvore'),
    create: (data: IpcPayload) => ipcRenderer.invoke('categoria-peca:create', data),
    update: (id: string, data: IpcPayload) => ipcRenderer.invoke('categoria-peca:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('categoria-peca:delete', id),
  },

  peca: {
    findAll: () => ipcRenderer.invoke('peca:findAll'),
    findById: (id: string) => ipcRenderer.invoke('peca:findById', id),
    create: (data: IpcPayload) => ipcRenderer.invoke('peca:create', data),
    update: (id: string, data: IpcPayload) => ipcRenderer.invoke('peca:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('peca:delete', id),
    search: (query: string) => ipcRenderer.invoke('peca:search', query),
    findByCategoria: (categoriaId: string) => ipcRenderer.invoke('peca:findByCategoria', categoriaId),
    findByCategoriaRecursiva: (categoriaId: string) => ipcRenderer.invoke('peca:findByCategoriaRecursiva', categoriaId),
  },

  regraWizard: {
    findByWizard: (wizardId: string) => ipcRenderer.invoke('regra-wizard:findByWizard', wizardId),
    save: (regras: IpcPayload[]) => ipcRenderer.invoke('regra-wizard:save', regras),
    calcularPecas: (wizardId: string, respostas: IpcPayload) => ipcRenderer.invoke('regra-wizard:calcularPecas', wizardId, respostas),
  },

  ia: {
    revisarOrtografia: (textoHtml: string) => {
      if (typeof textoHtml !== 'string') throw new Error('Texto inválido');
      return ipcRenderer.invoke('ia:revisarOrtografia', textoHtml);
    },
    adequarEscrita: (textoHtml: string) => {
      if (typeof textoHtml !== 'string') throw new Error('Texto inválido');
      return ipcRenderer.invoke('ia:adequarEscrita', textoHtml);
    },
    descreverImagem: (imagens: Array<{ src: string; alt?: string }>) => {
      if (!Array.isArray(imagens)) throw new Error('Imagens devem ser um array');
      return ipcRenderer.invoke('ia:descreverImagem', imagens);
    },
    perguntar: (pergunta: string, contexto?: string) => {
      if (typeof pergunta !== 'string' || !pergunta.trim()) throw new Error('Pergunta inválida');
      return ipcRenderer.invoke('ia:perguntar', pergunta, contexto);
    },
  },

  backup: {
    criar: () => ipcRenderer.invoke('backup:criar'),
    restaurar: () => ipcRenderer.invoke('backup:restaurar'),
    configExportar: () => ipcRenderer.invoke('backup:config-exportar'),
    configImportar: () => ipcRenderer.invoke('backup:config-importar'),
  },

  atualizacao: {
    estado: () => invokeSeguro<RespostaAtualizacao>('atualizacao:estado'),
    verificar: () => invokeSeguro<RespostaAtualizacao>('atualizacao:verificar'),
    baixar: () => invokeSeguro<RespostaAtualizacao>('atualizacao:baixar'),
    adiar: () => invokeSeguro<RespostaAtualizacao>('atualizacao:adiar'),
    prepararReinicio: () => invokeSeguro<RespostaAtualizacao>('atualizacao:preparar-reinicio'),
    instalarAgora: () => invokeSeguro<RespostaAtualizacao>('atualizacao:instalar-agora'),
    agendar: () => invokeSeguro<RespostaAtualizacao>('atualizacao:agendar'),
    selecionarOffline: () => invokeSeguro<RespostaAtualizacao>('atualizacao:selecionar-offline'),
    onSolicitarReinicio: (callback: () => boolean) => {
      const listener = (_event: Electron.IpcRendererEvent, id: unknown) => {
        if (typeof id !== 'string') return;
        let autorizado = false;
        try {
          autorizado = callback();
        } catch {
          autorizado = false;
        }
        void invokeSeguro('atualizacao:responder-reinicio', id, autorizado);
      };
      ipcRenderer.on('atualizacao:solicitar-reinicio', listener);
      return () => ipcRenderer.removeListener('atualizacao:solicitar-reinicio', listener);
    },
  },

  log: {
    listar: (filters?: Record<string, unknown>) => ipcRenderer.invoke('log:listar', filters),
    limpar: () => ipcRenderer.invoke('log:limpar'),
    listarAuditoria: (filters?: Record<string, unknown>) => ipcRenderer.invoke('log:listar-auditoria', filters),
    limparAuditoria: (userId?: string) => ipcRenderer.invoke('log:limpar-auditoria', userId),
    contar: () => ipcRenderer.invoke('log:contar'),
    timelineRep: (repId: string) => ipcRenderer.invoke('log:timeline-rep', repId),
  },

  diagnosticoInterno: {
    atualizarContextoRenderer: (contexto: Record<string, unknown>) => {
      ipcRenderer.send('diagnostico:atualizar-contexto-renderer', contexto);
    },
    registrarErroFatalRenderer: (erro: Record<string, unknown>) => {
      ipcRenderer.send('diagnostico:erro-fatal-renderer', erro);
    },
  },

  ilustracoes: {
    listarImagens: (laudoId: string) => ipcRenderer.invoke('ilustracoes:listar-imagens', laudoId),
    salvarImagem: (laudoId: string, imagem: SalvarImagemLaudoEntrada) => ipcRenderer.invoke('ilustracoes:salvar-imagem', laudoId, imagem),
    excluirImagem: (laudoId: string, imagemId: string) => ipcRenderer.invoke('ilustracoes:excluir-imagem', laudoId, imagemId),
    arquivarImagem: (laudoId: string, imagemId: string) => ipcRenderer.invoke('ilustracoes:arquivar-imagem', laudoId, imagemId),
    disponibilizarImagem: (laudoId: string, imagemId: string) => ipcRenderer.invoke('ilustracoes:disponibilizar-imagem', laudoId, imagemId),
    atualizarLegenda: (laudoId: string, imagemId: string, legenda: string) => ipcRenderer.invoke('ilustracoes:atualizar-legenda', laudoId, imagemId, legenda),
    atualizarOrdem: (laudoId: string, ordem: AtualizarOrdemImagemLaudoEntrada[]) => ipcRenderer.invoke('ilustracoes:atualizar-ordem', laudoId, ordem),
    openPanel: (laudoId: string, tituloLaudo?: string) => {
      if (typeof laudoId !== 'string' || !laudoId.trim()) throw new Error('Laudo inválido');
      ipcRenderer.send('ilustracoes:open-panel', laudoId, tituloLaudo);
    },
    closePanel: () => ipcRenderer.send('ilustracoes:close-panel'),
    syncToPanel: (data) => ipcRenderer.send('ilustracoes:sync-to-panel', data),
    sendAction: (action, ...args) => ipcRenderer.send('ilustracoes:panel-action', action, ...args),
    onPanelAction: (cb) => {
      const handler = (_event: Electron.IpcRendererEvent, action: string, ...args: unknown[]) => cb(action, ...args);
      ipcRenderer.on('ilustracoes:panel-action', handler);
      return () => { ipcRenderer.removeListener('ilustracoes:panel-action', handler); };
    },
    onStateSync: (cb) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { figurasNoEditor: unknown[]; syncEnabled: boolean; figuraAtivaId: string | null }) => cb(data);
      ipcRenderer.on('ilustracoes:state-sync', handler);
      return () => { ipcRenderer.removeListener('ilustracoes:state-sync', handler); };
    },
    onPanelClosed: (cb) => {
      const handler = () => cb();
      ipcRenderer.on('ilustracoes:panel-closed', handler);
      return () => { ipcRenderer.removeListener('ilustracoes:panel-closed', handler); };
    },
  },
} satisfies IpcAPI);

// Adicionar declaração de tipo para TypeScript no renderer
declare global {
  interface Window {
    ipcAPI: IpcAPI;
  }
}

