import { BaseService } from './base.service.js'
import { REPRow } from '../types/database.js'
import { getLogger } from '../utils/logger.js'
import { ehRegistroB601 } from '../../shared/types/b601.types.js'
import { esquemaRepsMesmoCasoGdl, type RepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso.js'

const log = getLogger('rep')

/**
 * Serviço para gerenciamento de REPs (Requisições de Exame Pericial)
 */
class RepService extends BaseService<REPRow> {
  constructor() {
    super('reps', 'id')
  }

  async salvarReferenciasMesmoCaso(id: string, numero: string, referencias: RepsMesmoCasoGdl, validarContexto: () => Promise<void>): Promise<void> {
    const snapshot = esquemaRepsMesmoCasoGdl.parse(referencias)
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const rep = await this.findById(id)
      if (!rep || rep.numero !== numero) throw new Error('A REP vinculada ao laudo mudou. Consulte novamente.')
      const campos: unknown = rep.campos_especificos ? JSON.parse(rep.campos_especificos) : {}
      if (!ehRegistroB601(campos)) throw new Error('Os dados locais da REP estão inválidos. Nenhuma referência foi gravada.')
      const integracao = campos.integracaoGdl ?? {}
      if (!ehRegistroB601(integracao)) throw new Error('Os metadados GDL da REP estão inválidos. Nenhuma referência foi gravada.')
      const conteudo = JSON.stringify({ ...campos, integracaoGdl: { ...integracao, repsMesmoCaso: snapshot } })
      await validarContexto()
      const alteradas = await this.executeCustomQuery<{ id: string }>(
        'UPDATE reps SET campos_especificos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND numero = ? AND campos_especificos IS ? RETURNING id',
        [conteudo, id, numero, rep.campos_especificos ?? null],
      )
      if (alteradas.length) return
    }
    throw new Error('A REP foi editada durante a consulta. Atualize as REPs do caso novamente.')
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
      log.error('Erro ao buscar Requisições ordenadas', error)
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
      log.error('Erro ao buscar Requisições por status', { status, error })
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
      log.error('Erro ao buscar Requisição por número', { numero, error })
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
      log.error('Erro ao atualizar status da Requisição', { id, status, error })
      throw error
    }
  }
}

// Instância singleton do serviço
export const repService = new RepService()
