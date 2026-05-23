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
}

// Solicitante (órgão/vara/delegacia)
export interface SolicitanteRow extends DatabaseRow {
  id: string
  nome: string
  tipo: string
  endereco?: string
  telefone?: string
  email?: string
  ativo?: boolean
  created_at: string
  updated_at: string
}

// Tipo de Exame
export interface TipoExameRow extends DatabaseRow {
  id: string
  codigo: string
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
  tipo_solicitacao?: string
  numero_documento?: string
  data_documento?: string
  autoridade_solicitante?: string
  nome_envolvido?: string
  data_acionamento?: string
  data_chegada?: string
  data_saida?: string
  local_fato?: string
  latitude?: number
  longitude?: number
  lacre_entrada?: string
  lacre_saida?: string
  usuario_id?: string
  numero_bo?: string
  numero_ip?: string
  observacoes?: string
  campos_especificos?: string
  created_at: string
  updated_at: string
}

// Laudo
export interface LaudoRow extends DatabaseRow {
  id: string
  rep_id: string
  perito_id: string
  template_id: string
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

// Template de Laudo
export interface TemplateRow extends DatabaseRow {
  id: string
  tipo_exame_id: string | null
  nome: string
  descricao?: string
  created_at: string
  updated_at: string
}

// Seção de Template
export interface SecaoTemplateRow extends DatabaseRow {
  id: string
  template_id: string
  nome: string
  ordem: number
  conteudo?: string
  created_at: string
  updated_at: string
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
  | TemplateRow
  | SecaoTemplateRow

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