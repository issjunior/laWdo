import { BaseService } from './base.service'
import { SolicitanteRow } from '../types/database'
import { logInfo, logError, logDebug } from '../utils/logger'
import { encrypt, decrypt } from '../security/crypto'

/**
 * Serviço para gerenciamento de solicitantes (órgãos, varas, delegacias)
 */
export class SolicitanteService extends BaseService<SolicitanteRow> {
  constructor() {
    super('solicitantes', 'id')
  }

  /**
   * Descriptografa campos sensíveis de um solicitante
   */
  private async decryptFields(
    solicitante: SolicitanteRow
  ): Promise<SolicitanteRow | null> {
    try {
      const decrypted = { ...solicitante }

      if (solicitante.telefone && this.isEncrypted(solicitante.telefone)) {
        decrypted.telefone = await decrypt(solicitante.telefone)
      }
      if (solicitante.email && this.isEncrypted(solicitante.email)) {
        decrypted.email = await decrypt(solicitante.email)
      }

      return decrypted
    } catch (error) {
      logError('Erro ao descriptografar campos do solicitante', { solicitante, error })
      throw error
    }
  }

  /**
   * Verifica se um texto parece ser criptografado
   */
  private isEncrypted(text: string): boolean {
    // Campos criptografados têm um formato específico (base64 de buffer com salt+iv+tag+dados)
    // Se for texto legítimo (telefone/email), será mais curto e não base64 válido
    try {
      if (text.length < 50) return false // Muito curto para ser criptografado
      const data = Buffer.from(text, 'base64')
      const minLength = 64 + 16 + 16 + 1 // salt(64) + iv(16) + tag(16) + dados(1)
      return data.length >= minLength
    } catch {
      return false
    }
  }

  /**
   * Buscar solicitante por nome
   */
  async findByNome(nome: string): Promise<SolicitanteRow | null> {
    try {
      const sql = 'SELECT * FROM solicitantes WHERE nome = ?'
      const rows = await this.executeCustomQuery<SolicitanteRow>(sql, [nome])
      if (rows.length > 0) {
        return await this.decryptFields(rows[0])
      }
      return null
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
      const decryptedRows = await Promise.all(
        rows.map(row => this.decryptFields(row))
      )
      return decryptedRows.filter((row): row is SolicitanteRow => row !== null)
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
   * Buscar todos os registros com paginação (sobreescrito para descriptografar)
   */
  async findAll(
    filters: Partial<SolicitanteRow> = {},
    options: {
      limit?: number
      offset?: number
      orderBy?: string
      orderDirection?: 'ASC' | 'DESC'
    } = {}
  ): Promise<SolicitanteRow[]> {
    try {
      const rows = await super.findAll(filters, options)
      const decryptedRows = await Promise.all(
        rows.map(row => this.decryptFields(row))
      )
      return decryptedRows.filter((row): row is SolicitanteRow => row !== null)
    } catch (error) {
      logError(`Erro ao buscar registros de ${this.tableName}`, error)
      throw error
    }
  }

  /**
   * Buscar por ID (sobreescrito para descriptografar)
   */
  async findById(id: string): Promise<SolicitanteRow | null> {
    try {
      const row = await super.findById(id)
      if (row) {
        return await this.decryptFields(row)
      }
      return null
    } catch (error) {
      logError(`Erro ao buscar ${this.tableName} por ID`, { id, error })
      throw error
    }
  }

  /**
   * Atualizar registro (sobreescrito para descriptografar o resultado)
   */
  async update(
    id: string,
    data: Partial<Omit<SolicitanteRow, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<SolicitanteRow | null> {
    try {
      const updated = await super.update(id, data)
      if (updated) {
        return await this.decryptFields(updated)
      }
      return null
    } catch (error) {
      logError(`Erro ao atualizar ${this.tableName}`, { id, data, error })
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
      const decryptedRows = await Promise.all(
        rows.map(row => this.decryptFields(row))
      )
      return decryptedRows.filter((row): row is SolicitanteRow => row !== null)
    } catch (error) {
      logError('Erro ao buscar solicitantes ativos', { filters, options, error })
      throw error
    }
  }
}

// Instância singleton do serviço
export const solicitanteService = new SolicitanteService()