import { BaseService } from './base.service.js'
import { REPRow } from '../types/database.js'
import { getLogger } from '../utils/logger.js'

const log = getLogger('rep')

/**
 * Serviço para gerenciamento de REPs (Requisições de Exame Pericial)
 */
export class RepService extends BaseService<REPRow> {
  constructor() {
    super('reps', 'id')
  }

  /**
   * Buscar todas as REPs ordenadas por data de criação (mais recentes primeiro)
   */
  async findAllOrdered(): Promise<REPRow[]> {
    try {
      const sql = 'SELECT * FROM reps ORDER BY created_at DESC'
      const rows = await this.executeCustomQuery<REPRow>(sql)
      return rows
    } catch (error) {
      log.error('Erro ao buscar REPs ordenadas', error)
      throw error
    }
  }

  /**
   * Buscar REPs por status
   */
  async findByStatus(status: string): Promise<REPRow[]> {
    try {
      const sql = 'SELECT * FROM reps WHERE status = ? ORDER BY created_at DESC'
      const rows = await this.executeCustomQuery<REPRow>(sql, [status])
      return rows
    } catch (error) {
      log.error('Erro ao buscar REPs por status', { status, error })
      throw error
    }
  }

  /**
   * Buscar REP por número
   */
  async findByNumero(numero: string): Promise<REPRow | null> {
    try {
      const sql = 'SELECT * FROM reps WHERE numero = ?'
      const rows = await this.executeCustomQuery<REPRow>(sql, [numero])
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      log.error('Erro ao buscar REP por número', { numero, error })
      throw error
    }
  }

  /**
   * Atualizar status de uma REP
   */
  async updateStatus(id: string, status: string): Promise<REPRow | null> {
    try {
      const sql = 'UPDATE reps SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      await this.executeCustomQuery(sql, [status, id])
      return await this.findById(id)
    } catch (error) {
      log.error('Erro ao atualizar status da REP', { id, status, error })
      throw error
    }
  }
}

// Instância singleton do serviço
export const repService = new RepService()
