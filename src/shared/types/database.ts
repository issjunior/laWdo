/**
 * Tipos para as entidades do banco de dados
 * Correspondem à estrutura das tabelas SQLite
 */

export interface DatabaseRow {
  [key: string]: any
}

// Usuário/Perito
export interface UserRow extends DatabaseRow {
  id: string
  nome: string
  email: string
  matricula?: string
  telefone?: string
  cargo?: string
  lotacao?: string
  username: string
  senha_hash: string
  ativo: boolean
  data_criacao: string
  data_atualizacao: string
  foto_url?: string
}

// Solicitante (órgão/vara/delegacia)
export interface SolicitanteRow extends DatabaseRow {
  id: string
  nome: string
  tipo: string
  endereco?: string
  telefone?: string
  email?: string
  created_at: string
  updated_at: string
}

// Tipo de Exame
export interface TipoExameRow extends DatabaseRow {
  id: string
  nome: string
  descricao?: string
  template_padrao?: string
  created_at: string
}

// REP (Requisição de Exame Pericial)
export interface REPRow extends DatabaseRow {
  id: string
  numero: string
  solicitante_id: string
  tipo_exame_id: string
  data_requisicao: string
  prazo?: string
  status: string
  observacoes?: string
  created_at: string
  updated_at: string
}

// Laudo
export interface LaudoRow extends DatabaseRow {
  id: string
  rep_id: string
  perito_id: string
  conteudo: string
  status: string
  data_inicio: string
  data_conclusao?: string
  data_entrega?: string
  versao: number
  created_at: string
  updated_at: string
}

// Placeholder
export interface PlaceholderRow extends DatabaseRow {
  id: string
  chave: string
  valor: string
  descricao?: string
  categoria?: string
  created_at: string
  updated_at: string
}

// Log do sistema (Winston)
export interface LogEntry {
  id: string
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
}

// Log de Auditoria
export interface LogAuditoriaRow extends DatabaseRow {
  id: number
  usuario_id?: string
  acao: string
  entidade: string
  entidade_id?: string
  detalhes?: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

/**
 * Mapeamento de tipos por nome de entidade
 */
export type EntityRow =
  | UserRow
  | SolicitanteRow
  | TipoExameRow
  | REPRow
  | LaudoRow
  | PlaceholderRow
  | LogAuditoriaRow

/**
 * Resultado de query
 */
export interface QueryResult<T = DatabaseRow> {
  rows: T[]
  lastInsertRowid?: number
  changes?: number
  duration?: number
}

/**
 * Paginação
 */
export interface PaginationOptions {
  page?: number
  pageSize?: number
  total?: number
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
}

/**
 * Resultado paginado
 */
export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}