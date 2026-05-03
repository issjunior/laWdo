/**
 * Tipos para os handlers IPC específicos de usuário
 */

export interface UserFilters {
  nome?: string
  email?: string
  matricula?: string
  cargo?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
}

export interface UserCreateData {
  nome: string
  email: string
  matricula?: string
  telefone?: string
  cargo?: string
}

export interface UserUpdateData {
  nome?: string
  matricula?: string
  telefone?: string
  cargo?: string
}

export interface UserProfileUpdateData {
  nome?: string
  matricula?: string
  telefone?: string
  cargo?: string
}

/**
 * Resposta padrão para operações de usuário
 */
export interface UserResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  total?: number
}

/**
 * Resultado paginado
 */
export interface PaginatedUserResponse<T = any> extends UserResponse<T> {
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

/**
 * Tipos para os handlers IPC específicos de solicitante
 */
export interface SolicitanteFilters {
  nome?: string
  tipo?: string
}

export interface SolicitanteCreateData {
  nome: string
  tipo: string
  endereco?: string
  telefone?: string
  email?: string
}

export interface SolicitanteUpdateData {
  nome?: string
  tipo?: string
  endereco?: string
  telefone?: string
  email?: string
}

/**
 * Tipos para os handlers IPC específicos de tipo de exame
 */
export interface TipoExameCreateData {
  nome: string
  descricao?: string
  template_padrao?: string
}

export interface TipoExameUpdateData {
  nome?: string
  descricao?: string
  template_padrao?: string
}