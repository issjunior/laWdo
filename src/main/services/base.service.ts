import { getLogger } from '../utils/logger.js'
import { executeQuery, executeNonQuery } from '../database/sqlite.js'

const log = getLogger('database')

/**
 * Serviço base com operações CRUD comuns
 */
export abstract class BaseService<T extends Record<string, any>> {
  protected tableName: string
  protected primaryKey: string

  constructor(tableName: string, primaryKey: string = 'id') {
    this.tableName = tableName
    this.primaryKey = primaryKey
  }

  /**
   * Buscar todos os registros com paginação
   */
  async findAll(
    filters: Partial<T> = {},
    options: {
      limit?: number
      offset?: number
      orderBy?: string
      orderDirection?: 'ASC' | 'DESC'
    } = {}
  ): Promise<T[]> {
    try {
      const {
        limit = 100,
        offset = 0,
        orderBy = 'created_at',
        orderDirection = 'DESC'
      } = options

      let whereClause = ''
      const params: any[] = []

      // Construir filtros
      const filterEntries = Object.entries(filters).filter(([_, value]) => value !== undefined)
      if (filterEntries.length > 0) {
        const conditions = filterEntries.map(([key, value], index) => {
          params.push(value)
          return `${key} = ?`
        })
        whereClause = `WHERE ${conditions.join(' AND ')}`
      }

      const sql = `
        SELECT * FROM ${this.tableName}
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT ? OFFSET ?
      `

      params.push(limit, offset)

      const rows = await executeQuery<T>(sql, params)
      return rows
    } catch (error) {
      log.error(`Erro ao buscar registros de ${this.tableName}`, error)
      throw error
    }
  }

  /**
   * Buscar por ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`
      const rows = await executeQuery<T>(sql, [id])

      if (rows.length === 0) {
        return null
      }

      return rows[0]
    } catch (error) {
      log.error(`Erro ao buscar ${this.tableName} por ID`, { id, error })
      throw error
    }
  }

  /**
   * Criar novo registro
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    try {
      const columns = Object.keys(data)
      const placeholders = columns.map(() => '?').join(', ')
      const values = Object.values(data)

      // Gerar UUID para o ID
      const id = this.generateUUID()
      const createdAt = new Date().toISOString()
      const updatedAt = createdAt

      const allColumns = [this.primaryKey, ...columns, 'created_at', 'updated_at']
      const allPlaceholders = ['?', ...placeholders.split(', '), '?', '?']
      const allValues = [id, ...values, createdAt, updatedAt]

      const sql = `
        INSERT INTO ${this.tableName} (${allColumns.join(', ')})
        VALUES (${allPlaceholders.join(', ')})
      `

      await executeNonQuery(sql, allValues)

      const created = await this.findById(id)
      if (!created) {
        throw new Error(`Falha ao recuperar ${this.tableName} criado`)
      }

      return created
    } catch (error) {
      log.error(`Erro ao criar ${this.tableName}`, { data, error })
      throw error
    }
  }

  /**
   * Atualizar registro
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T | null> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        return null
      }

      const columns = Object.keys(data)
      if (columns.length === 0) {
        return existing
      }

      const setClause = columns.map(col => `${col} = ?`).join(', ')
      const values = Object.values(data)
      const updatedAt = new Date().toISOString()

      const sql = `
        UPDATE ${this.tableName}
        SET ${setClause}, updated_at = ?
        WHERE ${this.primaryKey} = ?
      `

      await executeNonQuery(sql, [...values, updatedAt, id])

      const updated = await this.findById(id)
      return updated
    } catch (error) {
      log.error(`Erro ao atualizar ${this.tableName}`, { id, data, error })
      throw error
    }
  }

  /**
   * Excluir registro
   */
  async delete(id: string): Promise<boolean> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        return false
      }

      const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`
      await executeNonQuery(sql, [id])

      return true
    } catch (error) {
      log.error(`Erro ao excluir ${this.tableName}`, { id, error })
      throw error
    }
  }

  /**
   * Contar registros
   */
  async count(filters: Partial<T> = {}): Promise<number> {
    try {
      let whereClause = ''
      const params: any[] = []

      const filterEntries = Object.entries(filters).filter(([_, value]) => value !== undefined)
      if (filterEntries.length > 0) {
        const conditions = filterEntries.map(([key, value]) => {
          params.push(value)
          return `${key} = ?`
        })
        whereClause = `WHERE ${conditions.join(' AND ')}`
      }

      const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`
      const rows = await executeQuery<{ count: number }>(sql, params)

      return rows[0]?.count || 0
    } catch (error) {
      log.error(`Erro ao contar registros de ${this.tableName}`, error)
      throw error
    }
  }

  /**
   * Gerar UUID v4
   */
  protected generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * Executar query personalizada
   */
  protected async executeCustomQuery<TResult = any>(
    sql: string,
    params: any[] = []
  ): Promise<TResult[]> {
    return await executeQuery<TResult>(sql, params)
  }
}