import { contextBridge, ipcRenderer } from 'electron';
import type {
  AtualizacaoPainelIa,
  ContextoIa,
  ModeloIaDisponivel,
  PerfilRespostaIa,
  PlanoExecucaoIaResumo,
  RespostaDescricaoImagemIa,
  RespostaExecucaoIaIpc,
  RespostaConsultaIa,
  ComandoPainelIa,
  SolicitacaoDescricaoImagemIa,
  SolicitacaoIa,
  SolicitacaoConsultaIa,
  ProgressoIa,
  ProgressoConsultaIa,
} from '../shared/types/ia.types.js';
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
import type { ListaImagensRepGdl, ResultadoCapturaImagensLaudoGdl } from '../shared/types/gdl-arquivos.types.js';
import type {
  AtualizarOrdemImagemLaudoEntrada,
  ImagemLaudoPersistida,
  ImagemLaudoResumo,
  MiniaturaImagemLaudo,
  ResultadoReconciliacaoImagensLaudo,
  SalvarImagemLaudoEntrada,
} from '../shared/types/imagem-laudo.types.js';
import type { RespostaAtualizacao } from '../shared/atualizacao/atualizacao.types.js';

// O preload sandboxado não pode carregar módulos locais em tempo de execução.
function progressoIaValidoNoPreload(valor: unknown): valor is ProgressoIa {
  if (!valor || typeof valor !== 'object') return false;
  const progresso = valor as Record<string, unknown>;
  return typeof progresso.operationId === 'string'
    && Boolean(progresso.operationId)
    && (progresso.fase === 'preparando' || progresso.fase === 'processando' || progresso.fase === 'concluido')
    && Number.isInteger(progresso.loteAtual)
    && (progresso.loteAtual as number) >= 0
    && Number.isInteger(progresso.totalLotes)
    && (progresso.totalLotes as number) > 0
    && (progresso.loteAtual as number) <= (progresso.totalLotes as number)
    && Number.isInteger(progresso.tentativa)
    && (progresso.tentativa as number) >= 0
    && Number.isInteger(progresso.chamadasConcluidas)
    && (progresso.chamadasConcluidas as number) >= 0
    && (progresso.chamadasConcluidas as number) <= (progresso.totalLotes as number);
}

function progressoConsultaIaValidoNoPreload(valor: unknown): valor is ProgressoConsultaIa {
  if (!valor || typeof valor !== 'object') return false;
  const progresso = valor as Record<string, unknown>;
  return typeof progresso.operationId === 'string' && Boolean(progresso.operationId)
    && ['preparando', 'analisando', 'consolidando', 'verificando'].includes(String(progresso.fase));
}

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
type PacoteTemplateResponse = { success: boolean; data?: IpcPayload; nome?: string; error?: string };
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
    listarImagensLaudo: (laudoId: string) => Promise<UserResponse<ListaImagensRepGdl>>;
    capturarImagensLaudo: (laudoId: string, sessaoId: string, idsSelecao: string[], permitirDuplicadas?: boolean) => Promise<UserResponse<ResultadoCapturaImagensLaudoGdl>>;
    fecharSessaoImagensLaudo: (laudoId: string, sessaoId: string) => Promise<UserResponse>;
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
    previewPDF: (html: string, margins?: { top: number; right: number; bottom: number; left: number }, headerTemplate?: string, titulo?: string) => Promise<UserResponse>;
    importarArquivo: () => Promise<ImportarArquivoResponse>;
    exportarPacote: (templateId: string) => Promise<UserResponse>;
    selecionarPacote: () => Promise<PacoteTemplateResponse>;
    importarPacote: (caminho: string, criarTipo: boolean) => Promise<PacoteTemplateResponse>;
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
    perguntar: (pergunta: string, contexto?: string) => Promise<UserResponse>;
    obterContexto: () => Promise<UserResponse<ContextoIa>>;
    obterPerfil: () => Promise<UserResponse<PerfilRespostaIa>>;
    salvarPerfil: (perfil: PerfilRespostaIa) => Promise<UserResponse>;
    planejar: (solicitacao: SolicitacaoIa) => Promise<UserResponse<PlanoExecucaoIaResumo>>;
    executar: (solicitacao: SolicitacaoIa) => Promise<RespostaExecucaoIaIpc>;
    consultar: (solicitacao: SolicitacaoConsultaIa) => Promise<UserResponse<RespostaConsultaIa>>;
    listarModelos: () => Promise<UserResponse<ModeloIaDisponivel[]>>;
    descreverImagem: (solicitacao: SolicitacaoDescricaoImagemIa) => Promise<UserResponse<RespostaDescricaoImagemIa>>;
    cancelar: (operationId: string) => Promise<UserResponse>;
    descartarRetomada: (retomadaId: string) => Promise<UserResponse>;
    testarConexao: () => Promise<UserResponse<ContextoIa>>;
    copiarResposta: (texto: string, html?: string) => Promise<UserResponse>;
    onProgresso: (callback: (progresso: ProgressoIa) => void) => () => void;
    onProgressoConsulta: (callback: (progresso: ProgressoConsultaIa) => void) => () => void;
    painelAbrir: (sessionId: string) => void;
    painelFechar: () => void;
    painelPronto: () => void;
    painelPublicar: (sessionId: string, atualizacao: AtualizacaoPainelIa) => void;
    painelEnviarComando: (comando: ComandoPainelIa) => void;
    painelReencaixar: () => void;
    onPainelPronto: (callback: (sessionId: string) => void) => () => void;
    onPainelEstado: (callback: (estado: unknown) => void) => () => void;
    onPainelComando: (callback: (comando: ComandoPainelIa) => void) => () => void;
    onPainelReencaixar: (callback: (sessionId: string) => void) => () => void;
    onPainelFechado: (callback: (sessionId: string) => void) => () => void;
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
    reconciliarImagens: (laudoId: string) => Promise<{ success: boolean; data?: ResultadoReconciliacaoImagensLaudo; error?: string }>;
    listarImagens: (laudoId: string) => Promise<{ success: boolean; data?: ImagemLaudoResumo[]; error?: string }>;
    obterImagem: (laudoId: string, imagemId: string) => Promise<{ success: boolean; data?: ImagemLaudoPersistida; error?: string }>;
    obterMiniaturas: (laudoId: string, ids: string[]) => Promise<{ success: boolean; data?: MiniaturaImagemLaudo[]; error?: string }>;
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
  'gdl:fechar-sessao-imagens-laudo',
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
  'template:exportarPacote',
  'template:selecionarPacote',
  'template:importarPacote',

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
  'ia:descrever-imagem',
  'ia:perguntar',
  'ia:obter-contexto',
  'ia:obter-perfil',
  'ia:salvar-perfil',
  'ia:planejar',
  'ia:executar',
  'ia:consultar',
  'ia:listar-modelos',
  'ia:cancelar',
  'ia:descartar-retomada',
  'ia:testar-conexao',
  'ia:copiar-resposta',
  'ia:progresso',
  'ia:painel-abrir',
  'ia:painel-fechar',
  'ia:painel-pronto',
  'ia:painel-publicar',
  'ia:painel-comando',
  'ia:painel-reencaixar',

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
  'diagnostico:registrar-evento',

  // Painel de Ilustrações
  'ilustracoes:open-panel',
  'ilustracoes:reconciliar-imagens',
  'ilustracoes:listar-imagens',
  'ilustracoes:obter-imagem',
  'ilustracoes:obter-miniaturas',
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

const canaisDiagnosticoInternos = new Set([
  'diagnostico:atualizar-contexto-renderer',
  'diagnostico:erro-fatal-renderer',
  'diagnostico:registrar-evento',
]);

const registrarEventoIpcDiagnostico = (dados: Record<string, unknown>): void => {
  ipcRenderer.send('diagnostico:registrar-evento', dados);
};

function descreverElementoDiagnostico(alvo: EventTarget | null): Record<string, unknown> {
  if (!(alvo instanceof HTMLElement)) return { tipoElemento: 'desconhecido' };
  return {
    tipoElemento: alvo.tagName.toLowerCase(),
    papel: alvo.getAttribute('role'),
    identificador: alvo.getAttribute('data-diagnostico-id') || null,
  };
}

let ultimoRegistroRolagemDiagnostico = 0;
let capturaProblemaDiagnosticoAtiva = false;
let ultimoWheelDiagnostico = 0;
let ultimaEntradaUsuarioDiagnostico = 0;
let observadorIframesDiagnostico: MutationObserver | null = null;
let observadorEstruturalDiagnostico: MutationObserver | null = null;
let observadorResizeDiagnostico: ResizeObserver | null = null;
let observadorPerformanceDiagnostico: PerformanceObserver | null = null;
const iframesDiagnosticoInstalados = new WeakSet<HTMLIFrameElement>();
const posicoesRolagemDiagnostico = new Map<string, number>();

ipcRenderer.on('diagnostico:alterar-captura', (_evento, dados: unknown) => {
  capturaProblemaDiagnosticoAtiva = Boolean(
    dados && typeof dados === 'object' && (dados as Record<string, unknown>).ativa && (dados as Record<string, unknown>).finalidade === 'problema',
  );
  if (capturaProblemaDiagnosticoAtiva) {
    instalarSondasIframesDiagnostico();
    instalarSondasLayoutDiagnostico();
    observadorIframesDiagnostico ??= new MutationObserver(instalarSondasIframesDiagnostico);
    observadorIframesDiagnostico.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    observadorIframesDiagnostico?.disconnect();
    observadorIframesDiagnostico = null;
    observadorEstruturalDiagnostico?.disconnect();
    observadorEstruturalDiagnostico = null;
    observadorResizeDiagnostico?.disconnect();
    observadorResizeDiagnostico = null;
    observadorPerformanceDiagnostico?.disconnect();
    observadorPerformanceDiagnostico = null;
    posicoesRolagemDiagnostico.clear();
  }
});

function cadeiaRolavelDiagnostico(alvo: EventTarget | null): Array<Record<string, unknown>> {
  const cadeia: Array<Record<string, unknown>> = [];
  let atual = alvo instanceof HTMLElement ? alvo : null;
  while (atual && cadeia.length < 8) {
    const estilo = getComputedStyle(atual);
    if (/(auto|scroll|overlay)/.test(estilo.overflowY) || atual.scrollHeight > atual.clientHeight) {
      cadeia.push({ identificador: atual.getAttribute('data-diagnostico-id') || atual.id || atual.tagName.toLowerCase(), scrollTop: Math.round(atual.scrollTop), scrollHeight: atual.scrollHeight, clientHeight: atual.clientHeight });
    }
    atual = atual.parentElement;
  }
  return cadeia;
}

function registrarEventoInterfaceDiagnostico(tipo: string, alvo: EventTarget | null, dados: Record<string, unknown> = {}): void {
  if (!capturaProblemaDiagnosticoAtiva) return;
  registrarEventoIpcDiagnostico({ categoria: 'acao', nivel: 'debug', tipo, ...dados, ...descreverElementoDiagnostico(alvo) });
}

function instalarSondasLayoutDiagnostico(): void {
  const raizes = Array.from(document.querySelectorAll<HTMLElement>('[data-diagnostico-id]')).slice(0, 25);
  observadorResizeDiagnostico?.disconnect();
  observadorResizeDiagnostico = new ResizeObserver(entradas => {
    if (!capturaProblemaDiagnosticoAtiva) return;
    for (const entrada of entradas.slice(0, 25)) {
      const alvo = entrada.target;
      registrarEventoInterfaceDiagnostico('redimensionamento', alvo, {
        largura: Math.round(entrada.contentRect.width), altura: Math.round(entrada.contentRect.height),
      });
    }
  });
  raizes.forEach(raiz => observadorResizeDiagnostico?.observe(raiz));
  observadorEstruturalDiagnostico ??= new MutationObserver(mudancas => {
    if (!capturaProblemaDiagnosticoAtiva) return;
    const relevantes = mudancas.filter(mudanca => mudanca.target instanceof HTMLElement && mudanca.target.closest('[data-diagnostico-id]')).slice(0, 10);
    if (relevantes.length) registrarEventoInterfaceDiagnostico('mutacao_estrutural', relevantes[0]?.target ?? null, { quantidade: relevantes.length });
    instalarSondasIframesDiagnostico();
  });
  observadorEstruturalDiagnostico.observe(document.documentElement, { childList: true, subtree: true });
  if (typeof PerformanceObserver !== 'undefined') {
    observadorPerformanceDiagnostico?.disconnect();
    try {
      observadorPerformanceDiagnostico = new PerformanceObserver(lista => {
        for (const entrada of lista.getEntries().slice(-20)) {
          const shift = entrada as PerformanceEntry & { value?: number; hadRecentInput?: boolean; sources?: Array<{ node?: Node }> };
          if (typeof shift.value !== 'number' || shift.hadRecentInput) continue;
          registrarEventoInterfaceDiagnostico('layout_shift', shift.sources?.[0]?.node ?? null, { valor: Number(shift.value.toFixed(4)), teveEntradaRecente: false });
        }
      });
      observadorPerformanceDiagnostico.observe({ type: 'layout-shift', buffered: true });
    } catch { observadorPerformanceDiagnostico = null; }
  }
}

window.addEventListener('click', evento => {
  if (!capturaProblemaDiagnosticoAtiva) return;
  registrarEventoIpcDiagnostico({
    categoria: 'acao', nivel: 'info', tipo: 'clique_usuario', ...descreverElementoDiagnostico(evento.target),
  });
}, { capture: true });

window.addEventListener('pointerdown', evento => {
  ultimaEntradaUsuarioDiagnostico = performance.now();
  registrarEventoInterfaceDiagnostico('pointerdown', evento.target, { botao: evento.button, ponteiro: evento.pointerType });
}, { capture: true, passive: true });

window.addEventListener('keydown', evento => {
  ultimaEntradaUsuarioDiagnostico = performance.now();
  registrarEventoInterfaceDiagnostico('keydown', evento.target, { tecla: evento.key.length <= 32 ? evento.key : 'desconhecida', codigo: evento.code });
}, { capture: true });

window.addEventListener('focusin', evento => registrarEventoInterfaceDiagnostico('foco', evento.target), { capture: true });
window.addEventListener('hashchange', () => registrarEventoInterfaceDiagnostico('mudanca_rota', document.documentElement, { rota: window.location.hash }));
window.addEventListener('popstate', () => registrarEventoInterfaceDiagnostico('mudanca_rota', document.documentElement, { rota: window.location.hash }));

window.addEventListener('change', evento => {
  if (!capturaProblemaDiagnosticoAtiva) return;
  registrarEventoIpcDiagnostico({
    categoria: 'acao', nivel: 'info', tipo: 'alteracao_usuario', ...descreverElementoDiagnostico(evento.target),
  });
}, { capture: true });

window.addEventListener('load', evento => {
  if (!capturaProblemaDiagnosticoAtiva) return;
  if (!(evento.target instanceof HTMLImageElement)) return;
  registrarEventoIpcDiagnostico({
    categoria: 'acao', nivel: 'debug', tipo: 'imagem_carregada', largura: evento.target.naturalWidth, altura: evento.target.naturalHeight,
  });
}, { capture: true });

window.addEventListener('scroll', evento => {
  if (!capturaProblemaDiagnosticoAtiva) return;
  const agora = performance.now();
  if (agora - ultimoRegistroRolagemDiagnostico < 250) return;
  ultimoRegistroRolagemDiagnostico = agora;
  const alvo = evento.target;
  const elemento = alvo instanceof Document ? document.scrollingElement : alvo instanceof HTMLElement ? alvo : null;
  const y = elemento?.scrollTop ?? window.scrollY;
  const maximoY = Math.max(0, (elemento?.scrollHeight ?? document.documentElement.scrollHeight) - (elemento?.clientHeight ?? window.innerHeight));
  const identificador = elemento instanceof HTMLElement ? elemento.getAttribute('data-diagnostico-id') || elemento.tagName.toLowerCase() : 'documento';
  const anterior = posicoesRolagemDiagnostico.get(identificador) ?? y;
  posicoesRolagemDiagnostico.set(identificador, y);
  registrarEventoIpcDiagnostico({ categoria: 'acao', nivel: 'debug', tipo: 'scroll', y, maximoY, distancia: y - anterior, direcao: y === anterior ? 'nenhuma' : y > anterior ? 'baixo' : 'cima', teveWheelRecente: performance.now() - ultimoWheelDiagnostico <= 150, teveEntradaRecente: performance.now() - ultimaEntradaUsuarioDiagnostico <= 150, cadeiaRolavel: cadeiaRolavelDiagnostico(elemento), ...descreverElementoDiagnostico(elemento) });
}, { capture: true, passive: true });

window.addEventListener('wheel', evento => {
  if (!capturaProblemaDiagnosticoAtiva) return;
  ultimoWheelDiagnostico = performance.now();
  ultimaEntradaUsuarioDiagnostico = ultimoWheelDiagnostico;
  registrarEventoIpcDiagnostico({ categoria: 'acao', nivel: 'debug', tipo: 'wheel', deltaX: Math.round(evento.deltaX), deltaY: Math.round(evento.deltaY), cadeiaRolavel: cadeiaRolavelDiagnostico(evento.target), ...descreverElementoDiagnostico(evento.target) });
}, { capture: true, passive: true });

function registrarWheelIframeDiagnostico(evento: WheelEvent): void {
  if (!capturaProblemaDiagnosticoAtiva) return;
  ultimoWheelDiagnostico = performance.now();
  registrarEventoIpcDiagnostico({ categoria: 'acao', nivel: 'debug', tipo: 'wheel', origemDocumento: 'tinymce_iframe', deltaX: Math.round(evento.deltaX), deltaY: Math.round(evento.deltaY), cadeiaRolavel: cadeiaRolavelDiagnostico(evento.target), ...descreverElementoDiagnostico(evento.target) });
}

function registrarScrollIframeDiagnostico(evento: Event): void {
  if (!capturaProblemaDiagnosticoAtiva) return;
  const agora = performance.now();
  if (agora - ultimoRegistroRolagemDiagnostico < 250) return;
  ultimoRegistroRolagemDiagnostico = agora;
  const alvo = evento.target;
  const documento = alvo && typeof alvo === 'object' && 'scrollingElement' in alvo ? alvo as Document : null;
  const elemento = documento?.scrollingElement;
  if (!elemento) return;
  const maximoY = Math.max(0, elemento.scrollHeight - elemento.clientHeight);
  registrarEventoIpcDiagnostico({ categoria: 'acao', nivel: 'debug', tipo: 'scroll', origemDocumento: 'tinymce_iframe', y: elemento.scrollTop, maximoY, teveWheelRecente: performance.now() - ultimoWheelDiagnostico <= 150, cadeiaRolavel: cadeiaRolavelDiagnostico(elemento), ...descreverElementoDiagnostico(elemento) });
}

function registrarInteracaoIframeDiagnostico(evento: Event): void {
  if (!capturaProblemaDiagnosticoAtiva) return;
  const tipo = evento.type === 'pointerdown' ? 'pointerdown' : evento.type === 'keydown' ? 'keydown' : evento.type === 'focusin' ? 'foco' : 'alteracao_usuario';
  if (evento instanceof PointerEvent || evento instanceof KeyboardEvent) ultimaEntradaUsuarioDiagnostico = performance.now();
  const dados = evento instanceof KeyboardEvent ? { tecla: evento.key.length <= 32 ? evento.key : 'desconhecida', codigo: evento.code } : {};
  registrarEventoIpcDiagnostico({ categoria: 'acao', nivel: 'debug', tipo, origemDocumento: 'tinymce_iframe', ...dados, ...descreverElementoDiagnostico(evento.target) });
}

function instalarSondasIframesDiagnostico(): void {
  for (const iframe of Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe.tox-edit-area__iframe'))) {
    if (iframesDiagnosticoInstalados.has(iframe)) continue;
    iframesDiagnosticoInstalados.add(iframe);
    iframe.addEventListener('load', () => {
      try {
        const documento = iframe.contentDocument;
        if (!documento) return;
        documento.addEventListener('wheel', registrarWheelIframeDiagnostico, { capture: true, passive: true });
        documento.addEventListener('scroll', registrarScrollIframeDiagnostico, { capture: true, passive: true });
        documento.addEventListener('pointerdown', registrarInteracaoIframeDiagnostico, { capture: true, passive: true });
        documento.addEventListener('keydown', registrarInteracaoIframeDiagnostico, { capture: true });
        documento.addEventListener('focusin', registrarInteracaoIframeDiagnostico, { capture: true });
        documento.addEventListener('change', registrarInteracaoIframeDiagnostico, { capture: true });
      } catch { /* iframe fora da mesma origem não é instrumentado. */ }
    }, { once: true });
    if (iframe.contentDocument?.readyState === 'complete') iframe.dispatchEvent(new Event('load'));
  }
}

const invocarComDiagnostico = <T = IpcResult>(channel: string, ...args: IpcParams): Promise<T> => {
  const correlacaoId = crypto.randomUUID();
  const inicio = performance.now();
  if (!canaisDiagnosticoInternos.has(channel)) {
    registrarEventoIpcDiagnostico({ fase: 'inicio', canal: channel, correlacaoId });
  }
  return (ipcRenderer.invoke(channel, ...args) as Promise<T>).then(
    resposta => {
      if (!canaisDiagnosticoInternos.has(channel)) {
        registrarEventoIpcDiagnostico({ fase: 'sucesso', canal: channel, correlacaoId, duracaoMs: performance.now() - inicio });
      }
      return resposta;
    },
    erro => {
      if (!canaisDiagnosticoInternos.has(channel)) {
        registrarEventoIpcDiagnostico({
          fase: 'erro',
          canal: channel,
          correlacaoId,
          duracaoMs: performance.now() - inicio,
          erro: erro instanceof Error ? erro.message : 'Erro IPC não identificável',
        });
      }
      throw erro;
    },
  );
};

const enviarComDiagnostico = (channel: string, ...args: IpcParams): void => {
  const correlacaoId = crypto.randomUUID();
  if (!canaisDiagnosticoInternos.has(channel)) {
    registrarEventoIpcDiagnostico({ fase: 'envio', canal: channel, correlacaoId });
  }
  ipcRenderer.send(channel, ...args);
};

const invokeSeguro = <T = IpcResult>(channel: string, ...args: IpcParams): Promise<T> => {
  validarCanal(channel);
  return invocarComDiagnostico<T>(channel, ...args);
};

const sendSeguro = (channel: string, ...args: IpcParams): void => {
  validarCanal(channel);
  enviarComDiagnostico(channel, ...args);
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

    return invocarComDiagnostico('execute-query', trimmedQuery, params || []);
  },

  // Autenticação
  login: (username: string, password: string) => {
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new Error('Username e password devem ser strings');
    }

    if (!username.trim() || !password.trim()) {
      throw new Error('Username e password não podem ser vazios');
    }

    return invocarComDiagnostico('login', username.trim(), password.trim());
  },

  verifyPassword: (userId: string, password: string) => {
    if (typeof userId !== 'string' || typeof password !== 'string') return Promise.resolve({ success: false, valid: false, error: 'Dados inválidos' });
    return invocarComDiagnostico('user:verifyPassword', userId, password);
  },

  // Usuários
  user: {
    findAll: (filters = {}, options = {}) => {
      return invocarComDiagnostico('user:findAll', filters, options);
    },

    findById: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('user:findById', id.trim());
    },

    create: (userData: UserCreateData) => {
      if (!userData || typeof userData !== 'object') {
        throw new Error('Dados do usuário inválidos');
      }
      if (!userData.nome || !userData.email) {
        throw new Error('Nome e email são obrigatórios');
      }
      return invocarComDiagnostico('user:create', userData);
    },

    update: (id: string, updateData: UserUpdateData) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      if (!updateData || typeof updateData !== 'object') {
        throw new Error('Dados de atualização inválidos');
      }
      return invocarComDiagnostico('user:update', id.trim(), updateData);
    },

    delete: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('user:delete', id.trim());
    },

    findByEmail: (email: string) => {
      if (typeof email !== 'string' || !email.trim()) {
        throw new Error('Email inválido');
      }
      return invocarComDiagnostico('user:findByEmail', email.trim());
    },

    findActivePeritos: () => {
      return invocarComDiagnostico('user:findActivePeritos');
    },

    updateProfile: (userId: string, profileData: UserProfileUpdateData) => {
      if (typeof userId !== 'string' || !userId.trim()) {
        throw new Error('ID do usuário inválido');
      }
      if (!profileData || typeof profileData !== 'object') {
        throw new Error('Dados do perfil inválidos');
      }
      return invocarComDiagnostico('user:updateProfile', userId.trim(), profileData);
    },

    uploadAvatar: (userId: string, base64Data: string) => {
      if (typeof userId !== 'string' || !userId.trim()) {
        throw new Error('ID do usuário inválido');
      }
      if (typeof base64Data !== 'string' || !base64Data) {
        throw new Error('Dados da imagem inválidos');
      }
      return invocarComDiagnostico('user:uploadAvatar', userId.trim(), base64Data);
    },

    getAvatar: (userId: string) => {
      if (typeof userId !== 'string' || !userId.trim()) {
        throw new Error('ID do usuário inválido');
      }
      return invocarComDiagnostico('user:getAvatar', userId.trim());
    },
  },

  // Solicitantes
  solicitante: {
    findAll: (filters?: SolicitanteFilters, options?: PaginationOptions) => {
      return invocarComDiagnostico('solicitante:findAll', filters, options);
    },

    findAllSemFiltroStatus: (filters?: SolicitanteFilters, options?: PaginationOptions) => {
      return invocarComDiagnostico('solicitante:findAllSemFiltroStatus', filters, options);
    },

    findById: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('solicitante:findById', id.trim());
    },

    create: (solicitanteData: SolicitanteCreateData) => {
      if (!solicitanteData || typeof solicitanteData !== 'object') {
        throw new Error('Dados do solicitante inválidos');
      }
      if (!solicitanteData.nome) {
        throw new Error('Nome é obrigatório');
      }
      return invocarComDiagnostico('solicitante:create', solicitanteData);
    },

    update: (id: string, updateData: SolicitanteUpdateData) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      if (!updateData || typeof updateData !== 'object') {
        throw new Error('Dados de atualização inválidos');
      }
      return invocarComDiagnostico('solicitante:update', id.trim(), updateData);
    },

    delete: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('solicitante:delete', id.trim());
    },

    hardDelete: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('solicitante:hardDelete', id.trim());
    },

    toggleStatus: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('solicitante:toggleStatus', id.trim());
    },

    findByTipo: (tipo: string) => {
      if (typeof tipo !== 'string' || !tipo.trim()) {
        throw new Error('Tipo inválido');
      }
      return invocarComDiagnostico('solicitante:findByTipo', tipo.trim());
    },

    findTipos: () => {
      return invocarComDiagnostico('solicitante:findTipos');
    },

    findAtivos: (filters = {}, options = {}) => {
      return invocarComDiagnostico('solicitante:findAtivos', filters, options);
    },
  },

  // Tipos de Exame
  tipoExame: {
    findAll: () => {
      return invocarComDiagnostico('tipo-exame:findAll');
    },

    findById: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('tipo-exame:findById', id.trim());
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
      return invocarComDiagnostico('tipo-exame:create', tipoExameData);
    },

    update: (id: string, updateData: TipoExameUpdateData) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      if (!updateData || typeof updateData !== 'object') {
        throw new Error('Dados de atualização inválidos');
      }
      return invocarComDiagnostico('tipo-exame:update', id.trim(), updateData);
    },

    delete: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('tipo-exame:delete', id.trim());
    },

    findComTemplate: () => {
      return invocarComDiagnostico('tipo-exame:findComTemplate');
    },

    atualizarTemplate: (id: string, template: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      if (typeof template !== 'string') {
        throw new Error('Template inválido');
      }
      return invocarComDiagnostico('tipo-exame:atualizarTemplate', id.trim(), template);
    },

    obterTemplate: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('tipo-exame:obterTemplate', id.trim());
    },

    toggleStatus: (id: string) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('ID inválido');
      }
      return invocarComDiagnostico('tipo-exame:toggleStatus', id.trim());
    },

    findAllSemFiltroStatus: () => {
      return invocarComDiagnostico('tipo-exame:findAllSemFiltroStatus');
    },
  },

  configuracao: {
    obter: (chave: string) => {
      if (typeof chave !== 'string' || !chave.trim()) {
        throw new Error('Chave inválida');
      }
      return invocarComDiagnostico('configuracao:obter', chave.trim());
    },
    salvar: (chave: string, valor: string, tipo?: string, descricao?: string) => {
      if (typeof chave !== 'string' || !chave.trim()) {
        throw new Error('Chave inválida');
      }
      return invocarComDiagnostico('configuracao:salvar', chave.trim(), valor, tipo, descricao);
    },
  },

  gdl: {
    testarConexao: (ambiente?: string) => invocarComDiagnostico('gdl:testar-conexao', ambiente),
    obterValidacaoSessao: (ambiente?: string) => invocarComDiagnostico('gdl:obter-validacao-sessao', ambiente),
    limparValidacaoSessao: (ambiente?: string) => invocarComDiagnostico('gdl:limpar-validacao-sessao', ambiente),
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
      return invocarComDiagnostico('gdl:validar-credenciais', ambiente.trim(), credenciais, numero.trim(), ano.trim());
    },
    consultarRep: (numero: string, ano: string) => {
      if (typeof numero !== 'string' || !numero.trim()) {
        throw new Error('Número da REP é obrigatório');
      }
      if (typeof ano !== 'string' || !ano.trim()) {
        throw new Error('Ano da REP é obrigatório');
      }
      return invocarComDiagnostico('gdl:consultar-rep', numero.trim(), ano.trim());
    },
    listarImagensLaudo: (laudoId: string) => {
      if (typeof laudoId !== 'string' || !laudoId.trim()) throw new Error('Laudo inválido');
      return invocarComDiagnostico('gdl:listar-imagens-laudo', laudoId);
    },
    capturarImagensLaudo: (laudoId: string, sessaoId: string, idsSelecao: string[], permitirDuplicadas?: boolean) => {
      if (typeof laudoId !== 'string' || !laudoId.trim()) throw new Error('Laudo inválido');
      if (typeof sessaoId !== 'string' || !sessaoId.trim()) throw new Error('Sessão de imagens inválida');
      if (!Array.isArray(idsSelecao) || idsSelecao.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) {
        throw new Error('Seleção de imagens inválida');
      }
      return invocarComDiagnostico('gdl:capturar-imagens-laudo', laudoId, sessaoId, idsSelecao, permitirDuplicadas);
    },
    fecharSessaoImagensLaudo: (laudoId: string, sessaoId: string) => invocarComDiagnostico('gdl:fechar-sessao-imagens-laudo', laudoId, sessaoId),
  },

  rep: {
    findAll: () => invocarComDiagnostico('rep:findAll'),
    findById: (id: string) => invocarComDiagnostico('rep:findById', id),
    findByNumero: (numero: string) => invocarComDiagnostico('rep:findByNumero', numero),
    create: (data: IpcPayload) => invocarComDiagnostico('rep:create', data),
    update: (id: string, data: IpcPayload) => invocarComDiagnostico('rep:update', id, data),
    delete: (id: string) => invocarComDiagnostico('rep:delete', id),
    updateStatus: (id: string, status: string) => invocarComDiagnostico('rep:updateStatus', id, status),
  },

  dashboard: {
    resumo: () => invocarComDiagnostico('dashboard:resumo'),
    projecoes: () => invocarComDiagnostico('dashboard:projecoes'),
  },

  categoria: {
    findAll: () => invocarComDiagnostico('categoria:findAll'),
    findArvore: () => invocarComDiagnostico('categoria:findArvore'),
    create: (data: IpcPayload) => invocarComDiagnostico('categoria:create', data),
    update: (id: string, data: IpcPayload) => invocarComDiagnostico('categoria:update', id, data),
    delete: (id: string) => invocarComDiagnostico('categoria:delete', id),
  },

  placeholder: {
    findAll: () => invocarComDiagnostico('placeholder:findAll'),
    findById: (id: string) => invocarComDiagnostico('placeholder:findById', id),
    create: (data: IpcPayload) => invocarComDiagnostico('placeholder:create', data),
    update: (id: string, data: IpcPayload) => invocarComDiagnostico('placeholder:update', id, data),
    delete: (id: string) => invocarComDiagnostico('placeholder:delete', id),
    migrateSistema: () => invocarComDiagnostico('placeholder:migrateSistema'),
    seedSistema: () => invocarComDiagnostico('placeholder:seedSistema'),
  },

  template: {
    findAll: () => invocarComDiagnostico('template:findAll'),
    findById: (id: string) => invocarComDiagnostico('template:findById', id),
    findByTipoExame: (tipoExameId: string) => invocarComDiagnostico('template:findByTipoExame', tipoExameId),
    create: (data: IpcPayload) => invocarComDiagnostico('template:create', data),
    update: (id: string, data: IpcPayload) => invocarComDiagnostico('template:update', id, data),
    delete: (id: string) => invocarComDiagnostico('template:delete', id),
    findSecoes: (templateId: string) => invocarComDiagnostico('template:findSecoes', templateId),
    createSecao: (data: IpcPayload) => invocarComDiagnostico('template:createSecao', data),
    updateSecao: (id: string, data: IpcPayload) => invocarComDiagnostico('template:updateSecao', id, data),
    deleteSecao: (id: string) => invocarComDiagnostico('template:deleteSecao', id),
    reordenarSecoes: (templateId: string, idsOrdenados: string[]) => invocarComDiagnostico('template:reordenarSecoes', templateId, idsOrdenados),
    previewPDF: (html: string, margins?: { top: number; right: number; bottom: number; left: number }, headerTemplate?: string, titulo?: string) => invocarComDiagnostico('template:previewPDF', { html, margins, headerTemplate, titulo }),
    importarArquivo: () => invocarComDiagnostico('template:importarArquivo'),
    exportarPacote: (templateId: string) => invocarComDiagnostico('template:exportarPacote', templateId),
    selecionarPacote: () => invocarComDiagnostico('template:selecionarPacote'),
    importarPacote: (caminho: string, criarTipo: boolean) => invocarComDiagnostico('template:importarPacote', caminho, criarTipo),
  },

  laudo: {
    findAll: () => invocarComDiagnostico('laudo:findAll'),
    findAllByRepId: (repId: string) => invocarComDiagnostico('laudo:findAllByRepId', repId),
    findById: (id: string) => invocarComDiagnostico('laudo:findById', id),
    findByRepId: (repId: string) => invocarComDiagnostico('laudo:findByRepId', repId),
    updateConteudo: (laudoId: string, conteudo: string) => invocarComDiagnostico('laudo:updateConteudo', laudoId, conteudo),
    create: (data: { rep_id: string; perito_id: string; template_id: string }) => invocarComDiagnostico('laudo:create', data),
    delete: (laudoId: string, userId?: string) => invocarComDiagnostico('laudo:delete', laudoId, userId),
    updateStatus: (laudoId: string, status: string) => invocarComDiagnostico('laudo:updateStatus', laudoId, status),
    gerarWizard: (params: IpcPayload) => invocarComDiagnostico('laudo:gerarWizard', params),
    salvarProgressoWizard: (laudoId: string, respostas: IpcPayload) => invocarComDiagnostico('laudo:salvarProgressoWizard', laudoId, respostas),
    getRespostasWizard: (laudoId: string) => invocarComDiagnostico('laudo:getRespostasWizard', laudoId),
    exportar: (params: ExportacaoLaudoParams) => invocarComDiagnostico('laudo:exportar', params),
    verificarLibreOffice: () => invocarComDiagnostico('laudo:verificarLibreOffice'),
    sincronizarSecoes: (laudoId: string) => invocarComDiagnostico('laudo:sincronizarSecoes', laudoId),
  },

  wizard: {
    findAll: () => invocarComDiagnostico('wizard:findAll'),
    findById: (id: string) => invocarComDiagnostico('wizard:findById', id),
    findByTipoExame: (tipoExameId: string) => invocarComDiagnostico('wizard:findByTipoExame', tipoExameId),
    create: (data: IpcPayload) => invocarComDiagnostico('wizard:create', data),
    update: (id: string, data: IpcPayload) => invocarComDiagnostico('wizard:update', id, data),
    delete: (id: string) => invocarComDiagnostico('wizard:delete', id),
    getArvore: (wizardId: string) => invocarComDiagnostico('wizard:getArvore', wizardId),
    saveArvore: (wizardId: string, arvore: IpcPayload) => invocarComDiagnostico('wizard:saveArvore', wizardId, arvore),
  },

  categoriaPeca: {
    findAll: () => invocarComDiagnostico('categoria-peca:findAll'),
    findArvore: () => invocarComDiagnostico('categoria-peca:findArvore'),
    create: (data: IpcPayload) => invocarComDiagnostico('categoria-peca:create', data),
    update: (id: string, data: IpcPayload) => invocarComDiagnostico('categoria-peca:update', id, data),
    delete: (id: string) => invocarComDiagnostico('categoria-peca:delete', id),
  },

  peca: {
    findAll: () => invocarComDiagnostico('peca:findAll'),
    findById: (id: string) => invocarComDiagnostico('peca:findById', id),
    create: (data: IpcPayload) => invocarComDiagnostico('peca:create', data),
    update: (id: string, data: IpcPayload) => invocarComDiagnostico('peca:update', id, data),
    delete: (id: string) => invocarComDiagnostico('peca:delete', id),
    search: (query: string) => invocarComDiagnostico('peca:search', query),
    findByCategoria: (categoriaId: string) => invocarComDiagnostico('peca:findByCategoria', categoriaId),
    findByCategoriaRecursiva: (categoriaId: string) => invocarComDiagnostico('peca:findByCategoriaRecursiva', categoriaId),
  },

  regraWizard: {
    findByWizard: (wizardId: string) => invocarComDiagnostico('regra-wizard:findByWizard', wizardId),
    save: (regras: IpcPayload[]) => invocarComDiagnostico('regra-wizard:save', regras),
    calcularPecas: (wizardId: string, respostas: IpcPayload) => invocarComDiagnostico('regra-wizard:calcularPecas', wizardId, respostas),
  },

  ia: {
    revisarOrtografia: (textoHtml: string) => {
      if (typeof textoHtml !== 'string') throw new Error('Texto inválido');
      return invocarComDiagnostico('ia:revisarOrtografia', textoHtml);
    },
    adequarEscrita: (textoHtml: string) => {
      if (typeof textoHtml !== 'string') throw new Error('Texto inválido');
      return invocarComDiagnostico('ia:adequarEscrita', textoHtml);
    },
    perguntar: (pergunta: string, contexto?: string) => {
      if (typeof pergunta !== 'string' || !pergunta.trim()) throw new Error('Pergunta inválida');
      return invocarComDiagnostico('ia:perguntar', pergunta, contexto);
    },
    obterContexto: () => invocarComDiagnostico('ia:obter-contexto'),
    obterPerfil: () => invocarComDiagnostico('ia:obter-perfil'),
    salvarPerfil: (perfil: PerfilRespostaIa) => invocarComDiagnostico('ia:salvar-perfil', perfil),
    planejar: (solicitacao: SolicitacaoIa) => invocarComDiagnostico('ia:planejar', solicitacao),
    executar: (solicitacao: SolicitacaoIa) => invocarComDiagnostico('ia:executar', solicitacao),
    consultar: (solicitacao: SolicitacaoConsultaIa) => invocarComDiagnostico('ia:consultar', solicitacao),
    listarModelos: () => invocarComDiagnostico('ia:listar-modelos'),
    descreverImagem: (solicitacao: SolicitacaoDescricaoImagemIa) => invocarComDiagnostico('ia:descrever-imagem', solicitacao),
    cancelar: (operationId: string) => invocarComDiagnostico('ia:cancelar', operationId),
    descartarRetomada: (retomadaId: string) => invocarComDiagnostico('ia:descartar-retomada', retomadaId),
    testarConexao: () => invocarComDiagnostico('ia:testar-conexao'),
    copiarResposta: (texto: string, html?: string) => invocarComDiagnostico('ia:copiar-resposta', texto, html),
    onProgresso: (callback: (progresso: ProgressoIa) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progresso: unknown) => {
        if (progressoIaValidoNoPreload(progresso)) callback(progresso);
      };
      ipcRenderer.on('ia:progresso', listener);
      return () => ipcRenderer.removeListener('ia:progresso', listener);
    },
    onProgressoConsulta: (callback: (progresso: ProgressoConsultaIa) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progresso: unknown) => {
        if (progressoConsultaIaValidoNoPreload(progresso)) callback(progresso);
      };
      ipcRenderer.on('ia:consulta-progresso', listener);
      return () => ipcRenderer.removeListener('ia:consulta-progresso', listener);
    },
    painelAbrir: (sessionId: string) => enviarComDiagnostico('ia:painel-abrir', sessionId),
    painelFechar: () => enviarComDiagnostico('ia:painel-fechar'),
    painelPronto: () => enviarComDiagnostico('ia:painel-pronto'),
    painelPublicar: (sessionId: string, atualizacao: AtualizacaoPainelIa) => enviarComDiagnostico('ia:painel-publicar', sessionId, atualizacao),
    painelEnviarComando: (comando: ComandoPainelIa) => enviarComDiagnostico('ia:painel-comando', comando),
    painelReencaixar: () => enviarComDiagnostico('ia:painel-reencaixar'),
    onPainelPronto: (callback: (sessionId: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, sessionId: string) => callback(sessionId);
      ipcRenderer.on('ia:painel-pronto', listener);
      return () => ipcRenderer.removeListener('ia:painel-pronto', listener);
    },
    onPainelEstado: (callback: (estado: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, estado: unknown) => callback(estado);
      ipcRenderer.on('ia:painel-estado', listener);
      return () => ipcRenderer.removeListener('ia:painel-estado', listener);
    },
    onPainelComando: (callback: (comando: ComandoPainelIa) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, comando: ComandoPainelIa) => callback(comando);
      ipcRenderer.on('ia:painel-comando', listener);
      return () => ipcRenderer.removeListener('ia:painel-comando', listener);
    },
    onPainelReencaixar: (callback: (sessionId: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, sessionId: string) => callback(sessionId);
      ipcRenderer.on('ia:painel-reencaixar', listener);
      return () => ipcRenderer.removeListener('ia:painel-reencaixar', listener);
    },
    onPainelFechado: (callback: (sessionId: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, sessionId: string) => callback(sessionId);
      ipcRenderer.on('ia:painel-fechado', listener);
      return () => ipcRenderer.removeListener('ia:painel-fechado', listener);
    },
  },

  backup: {
    criar: () => invocarComDiagnostico('backup:criar'),
    restaurar: () => invocarComDiagnostico('backup:restaurar'),
    configExportar: () => invocarComDiagnostico('backup:config-exportar'),
    configImportar: () => invocarComDiagnostico('backup:config-importar'),
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
    listar: (filters?: Record<string, unknown>) => invocarComDiagnostico('log:listar', filters),
    limpar: () => invocarComDiagnostico('log:limpar'),
    listarAuditoria: (filters?: Record<string, unknown>) => invocarComDiagnostico('log:listar-auditoria', filters),
    limparAuditoria: (userId?: string) => invocarComDiagnostico('log:limpar-auditoria', userId),
    contar: () => invocarComDiagnostico('log:contar'),
    timelineRep: (repId: string) => invocarComDiagnostico('log:timeline-rep', repId),
  },

  diagnosticoInterno: {
    atualizarContextoRenderer: (contexto: Record<string, unknown>) => {
      enviarComDiagnostico('diagnostico:atualizar-contexto-renderer', contexto);
    },
    registrarErroFatalRenderer: (erro: Record<string, unknown>) => {
      enviarComDiagnostico('diagnostico:erro-fatal-renderer', erro);
    },
  },

  ilustracoes: {
    reconciliarImagens: (laudoId: string) => invocarComDiagnostico('ilustracoes:reconciliar-imagens', laudoId),
    listarImagens: (laudoId: string) => invocarComDiagnostico('ilustracoes:listar-imagens', laudoId),
    obterImagem: (laudoId: string, imagemId: string) => invocarComDiagnostico('ilustracoes:obter-imagem', laudoId, imagemId),
    obterMiniaturas: (laudoId: string, ids: string[]) => invocarComDiagnostico('ilustracoes:obter-miniaturas', laudoId, ids),
    salvarImagem: (laudoId: string, imagem: SalvarImagemLaudoEntrada) => invocarComDiagnostico('ilustracoes:salvar-imagem', laudoId, imagem),
    excluirImagem: (laudoId: string, imagemId: string) => invocarComDiagnostico('ilustracoes:excluir-imagem', laudoId, imagemId),
    arquivarImagem: (laudoId: string, imagemId: string) => invocarComDiagnostico('ilustracoes:arquivar-imagem', laudoId, imagemId),
    disponibilizarImagem: (laudoId: string, imagemId: string) => invocarComDiagnostico('ilustracoes:disponibilizar-imagem', laudoId, imagemId),
    atualizarLegenda: (laudoId: string, imagemId: string, legenda: string) => invocarComDiagnostico('ilustracoes:atualizar-legenda', laudoId, imagemId, legenda),
    atualizarOrdem: (laudoId: string, ordem: AtualizarOrdemImagemLaudoEntrada[]) => invocarComDiagnostico('ilustracoes:atualizar-ordem', laudoId, ordem),
    openPanel: (laudoId: string, tituloLaudo?: string) => {
      if (typeof laudoId !== 'string' || !laudoId.trim()) throw new Error('Laudo inválido');
      enviarComDiagnostico('ilustracoes:open-panel', laudoId, tituloLaudo);
    },
    closePanel: () => enviarComDiagnostico('ilustracoes:close-panel'),
    syncToPanel: (data) => enviarComDiagnostico('ilustracoes:sync-to-panel', data),
    sendAction: (action, ...args) => enviarComDiagnostico('ilustracoes:panel-action', action, ...args),
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
