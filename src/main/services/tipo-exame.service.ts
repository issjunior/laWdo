import { BaseService } from './base.service.js'
import { TipoExameRow } from '../types/database.js'
import { logInfo, logError, logDebug } from '../utils/logger.js'

/**
 * Serviço para gerenciamento de tipos de exame
 */
export class TipoExameService extends BaseService<TipoExameRow> {
  constructor() {
    super('tipos_exame', 'id')
  }

  /**
   * Buscar tipo de exame por nome
   */
  async findByNome(nome: string): Promise<TipoExameRow | null> {
    try {
      const sql = 'SELECT * FROM tipos_exame WHERE nome = ?'
      const rows = await this.executeCustomQuery<TipoExameRow>(sql, [nome])
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      logError(`Erro ao buscar tipo de exame por nome`, { nome, error })
      throw error
    }
  }

  /**
   * Buscar todos os tipos de exame ordenados por nome
   */
  async findAllOrdered(): Promise<TipoExameRow[]> {
    try {
      const sql = 'SELECT * FROM tipos_exame ORDER BY nome ASC'
      const rows = await this.executeCustomQuery<TipoExameRow>(sql)
      return rows
    } catch (error) {
      logError('Erro ao buscar tipos de exame ordenados', error)
      throw error
    }
  }

  /**
   * Buscar tipos de exame com template padrão
   */
  async findComTemplate(): Promise<TipoExameRow[]> {
    try {
      const sql = 'SELECT * FROM tipos_exame WHERE template_padrao IS NOT NULL AND template_padrao != "" ORDER BY nome ASC'
      const rows = await this.executeCustomQuery<TipoExameRow>(sql)
      return rows
    } catch (error) {
      logError('Erro ao buscar tipos de exame com template', error)
      throw error
    }
  }

  /**
   * Atualizar template padrão de um tipo de exame
   */
  async atualizarTemplate(
    id: string,
    template: string
  ): Promise<TipoExameRow | null> {
    try {
      logDebug('Atualizando template de tipo de exame', { id })
      const updated = await this.update(id, { template_padrao: template })

      if (updated) {
        logDebug('Template atualizado', { id, nome: updated.nome })
      }

      return updated
    } catch (error) {
      logError('Erro ao atualizar template', { id, error })
      throw error
    }
  }

  /**
   * Obter template padrão de um tipo de exame
   */
  async obterTemplate(id: string): Promise<string | null> {
    try {
      const tipoExame = await this.findById(id)
      return tipoExame?.template_padrao || null
    } catch (error) {
      logError('Erro ao obter template', { id, error })
      throw error
    }
  }
}

// Instância singleton do serviço
export const tipoExameService = new TipoExameService()