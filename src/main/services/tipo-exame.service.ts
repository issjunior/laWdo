import { BaseService } from './base.service.js'
import { TipoExameRow } from '../types/database.js'
import { getLogger } from '../utils/logger.js'
const log = getLogger('tipo_exame')

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
      log.error(`Erro ao buscar tipo de exame por nome`, { nome, error })
      throw error
    }
  }

  /**
   * Buscar todos os tipos de exame ordenados por nome
   */
  async findAllOrdered(): Promise<TipoExameRow[]> {
    try {
      const sql = 'SELECT * FROM tipos_exame WHERE ativo = 1 ORDER BY nome ASC'
      const rows = await this.executeCustomQuery<TipoExameRow>(sql)
      return rows
    } catch (error) {
      log.error('Erro ao buscar tipos de exame ordenados', error)
      throw error
    }
  }

  /**
   * Buscar todos os tipos de exame (ativos e inativos)
   */
  async findAllSemFiltroStatus(): Promise<TipoExameRow[]> {
    try {
      const sql = 'SELECT * FROM tipos_exame ORDER BY nome ASC'
      const rows = await this.executeCustomQuery<TipoExameRow>(sql)
      return rows
    } catch (error) {
      log.error('Erro ao buscar tipos de exame sem filtro de status', error)
      throw error
    }
  }

  /**
   * Ativar/desativar tipo de exame (toggle)
   */
  async toggleStatus(id: string): Promise<TipoExameRow | null> {
    try {
      const tipo = await this.findById(id)
      if (!tipo) return null

      const novoStatus = tipo.ativo ? 0 : 1
      const sql = 'UPDATE tipos_exame SET ativo = ? WHERE id = ?'
      await this.executeCustomQuery(sql, [novoStatus, id])

      return await this.findById(id)
    } catch (error) {
      log.error('Erro ao alternar status do tipo de exame', { id, error })
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
      log.error('Erro ao buscar tipos de exame com template', error)
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
      log.debug('Atualizando template de tipo de exame', { id })
      const updated = await this.update(id, { template_padrao: template })

      if (updated) {
        log.debug('Template atualizado', { id, nome: updated.nome })
      }

      return updated
    } catch (error) {
      log.error('Erro ao atualizar template', { id, error })
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
      log.error('Erro ao obter template', { id, error })
      throw error
    }
  }
}

// Instância singleton do serviço
export const tipoExameService = new TipoExameService()