import { BaseService } from './base.service'
import { SolicitanteRow } from '../types/database'
import { logInfo, logError, logDebug } from '../utils/logger'
import { encrypt } from '../security/crypto'

/**
 * Serviço para gerenciamento de solicitantes (órgãos, varas, delegacias)
 */
export class SolicitanteService extends BaseService<SolicitanteRow> {
  constructor() {
    super('solicitantes', 'id')
  }

  /**
   * Buscar solicitante por nome
   */
  async findByNome(nome: string): Promise<SolicitanteRow | null> {
    try {
      const sql = 'SELECT * FROM solicitantes WHERE nome = ?'
      const rows = await this.executeCustomQuery<SolicitanteRow>(sql, [nome])
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      logError(`Erro ao buscar solicitante por nome`, { nome, error })
      throw error
    }
  }

  /**
   * Buscar solicitantes por tipo
   */
  async findByTipo(tipo: string): Promise<SolicitanteRow[]> {
    try {
      const sql = 'SELECT * FROM solicitantes WHERE tipo = ? ORDER BY nome ASC'
      const rows = await this.executeCustomQuery<SolicitanteRow>(sql, [tipo])
      return rows
    } catch (error) {
      logError(`Erro ao buscar solicitantes por tipo`, { tipo, error })
      throw error
    }
  }

  /**
   * Buscar todos os tipos de solicitantes únicos
   */
  async findTipos(): Promise<string[]> {
    try {
      const sql = 'SELECT DISTINCT tipo FROM solicitantes ORDER BY tipo ASC'
      const rows = await this.executeCustomQuery<{ tipo: string }>(sql)
      return rows.map(row => row.tipo)
    } catch (error) {
      logError(`Erro ao buscar tipos de solicitantes`, error)
      throw error
    }
  }

  /**
   * Criar solicitante com dados criptografados
   */
  async createSolicitante(
    data: Omit<SolicitanteRow, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SolicitanteRow> {
    try {
      // Criptografar dados sensíveis
      const encryptedData = { ...data }
      if (data.telefone) {
        encryptedData.telefone = await encrypt(data.telefone)
      }
      if (data.email) {
        encryptedData.email = await encrypt(data.email)
      }

      logDebug('Criando solicitante', { nome: data.nome })

      const solicitante = await this.create(encryptedData)
      logDebug('Solicitante criado', { id: solicitante.id, nome: solicitante.nome })

      return solicitante
    } catch (error) {
      logError('Erro ao criar solicitante', { data, error })
      throw error
    }
  }

  /**
   * Atualizar solicitante com dados criptografados
   */
  async updateSolicitante(
    id: string,
    data: Partial<Omit<SolicitanteRow, 'id' | 'created_at'>>
  ): Promise<SolicitanteRow | null> {
    try {
      // Criptografar dados sensíveis
      const encryptedData: Partial<Omit<SolicitanteRow, 'id' | 'created_at'>> = { ...data }
      if (data.telefone) {
        encryptedData.telefone = await encrypt(data.telefone)
      }
      if (data.email) {
        encryptedData.email = await encrypt(data.email)
      }

      logDebug('Atualizando solicitante', { id })
      const updated = await this.update(id, encryptedData)

      if (updated) {
        logDebug('Solicitante atualizado', { id, nome: updated.nome })
      }

      return updated
    } catch (error) {
      logError('Erro ao atualizar solicitante', { id, data, error })
      throw error
    }
  }

  /**
   * Buscar solicitantes ativos com paginação
   */
  async findAtivos(
    filters: { tipo?: string } = {},
    options: { limit?: number; offset?: number } = {}
  ): Promise<SolicitanteRow[]> {
    try {
      const { limit = 100, offset = 0 } = options
      let whereClause = ''
      const params: any[] = []

      if (filters.tipo) {
        whereClause = 'WHERE tipo = ?'
        params.push(filters.tipo)
      }

      const sql = `
        SELECT * FROM solicitantes
        ${whereClause}
        ORDER BY nome ASC
        LIMIT ? OFFSET ?
      `

      params.push(limit, offset)
      const rows = await this.executeCustomQuery<SolicitanteRow>(sql, params)
      return rows
    } catch (error) {
      logError('Erro ao buscar solicitantes ativos', { filters, options, error })
      throw error
    }
  }
}

// Instância singleton do serviço
export const solicitanteService = new SolicitanteService()