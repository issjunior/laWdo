/**
 * Tipos para o sistema de logs modular
 */

export const LOG_MODULES = [
  'database',
  'auth',
  'laudo',
  'template',
  'rep',
  'solicitante',
  'tipo_exame',
  'placeholder',
  'backup',
  'configuracao',
  'ia',
  'ilustracao',
  'renderer',
  'sistema',
  'ipc',
  'security',
  'wizard',
  'peca',
  'regra-wizard',
] as const;

export type LogModule = (typeof LOG_MODULES)[number];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const TIPOS_ACAO = [
  'login',
  'logout',
  'criacao',
  'atualizacao',
  'exclusao',
  'leitura',
  'exportacao',
  'importacao',
  'backup',
  'restauracao',
  'configuracao',
  'transicao_status',
  'limpeza_logs',
  'erro',
  'outro',
] as const;

export type TipoAcao = (typeof TIPOS_ACAO)[number];

/**
 * Entrada de log de sistema (Winston JSON)
 */
export interface SystemLogEntry {
  timestamp: string;
  level: LogLevel;
  module: LogModule;
  message: string;
  userId?: string;
  entity?: string;
  entityId?: string;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
  };
  meta?: Record<string, unknown>;
}

/**
 * Entrada de log de sistema legada (parser do formato texto antigo)
 * Mantida para compatibilidade durante migração e leitura de logs antigos
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  module?: LogModule;
}

/**
 * Entrada de log de auditoria (tabela logs_auditoria)
 */
export interface AuditEntry {
  id?: number;
  usuario_id?: string | null;
  acao: string;
  tipo_acao: TipoAcao;
  modulo: LogModule;
  entidade: string;
  entidade_id?: string | null;
  nivel: LogLevel;
  mensagem?: string | null;
  dados_anteriores?: string | null;
  dados_novos?: string | null;
  detalhes?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string;
}

/**
 * Input para criação de log de auditoria
 */
export interface CreateAuditEntry {
  usuario_id?: string | null;
  acao: string;
  tipo_acao: TipoAcao;
  modulo: LogModule;
  entidade: string;
  entidade_id?: string | null;
  nivel?: LogLevel;
  mensagem?: string | null;
  dados_anteriores?: string | null;
  dados_novos?: string | null;
  detalhes?: string | null;
}

/**
 * Interface do logger por módulo
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, errorOrMeta?: Error | Record<string, unknown>): void;
  debug(message: string | (() => string), meta?: Record<string, unknown>): void;
}

/**
 * Configuração de nível de log por módulo
 */
export type ModuleLogLevels = Partial<Record<LogModule, LogLevel>>;

/**
 * Filtros para consulta de logs
 */
export interface LogFilters {
  module?: LogModule;
  level?: LogLevel;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Filtros para consulta de auditoria
 */
export interface AuditFilters {
  usuario_id?: string;
  modulo?: LogModule;
  tipo_acao?: TipoAcao;
  nivel?: LogLevel;
  entidade?: string;
  entidade_id?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Contagem de logs
 */
export interface LogCount {
  sistema: number;
  auditoria: number;
}
