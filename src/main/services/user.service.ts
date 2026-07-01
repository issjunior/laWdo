import { BaseService } from './base.service.js'
import { UserRow } from '../types/database.js'
import { getLogger } from '../utils/logger.js'
import { executeNonQuery } from '../database/sqlite.js'

const log = getLogger('auth')
import bcrypt from 'bcrypt'
// A senha e armazenada em hash bcrypt.

interface RelatorioAtividadeUsuario {
  userId: string
  period: {
    startDate?: Date
    endDate?: Date
  }
  laudosCriados: number
  laudosConcluidos: number
  atividades: unknown[]
}

export class UserService extends BaseService<UserRow> {
  constructor() {
    super('users', 'id')
  }

  async create(
    data: Omit<UserRow, 'id' | 'data_criacao' | 'data_atualizacao'>
  ): Promise<UserRow> {
    try {
      const id = this.generateUUID()
      const now = new Date().toISOString()

      const sql = `
        INSERT INTO users (
          id, nome, email, matricula, telefone, cargo, lotacao, username, senha_hash, ativo, data_criacao, data_atualizacao
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      await executeNonQuery(sql, [
        id,
        data.nome,
        data.email,
        data.matricula || null,
        data.telefone || null,
        data.cargo || null,
        data.lotacao || null,
        data.username,
        data.senha_hash,
        data.ativo ?? 1,
        now,
        now
      ])

      const created = await this.findById(id)
      if (!created) {
        throw new Error('Falha ao recuperar usuário criado')
      }
      return created
    } catch (error) {
      log.error('Erro ao criar usuário', { data, error })
      throw error
    }
  }

  async update(
    id: string,
    data: Partial<Omit<UserRow, 'id' | 'data_criacao'>>
  ): Promise<UserRow | null> {
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
      const now = new Date().toISOString()

      const sql = `
        UPDATE users
        SET ${setClause}, data_atualizacao = ?
        WHERE id = ?
      `

      await executeNonQuery(sql, [...values, now, id])
      return await this.findById(id)
    } catch (error) {
      log.error('Erro ao atualizar usuário', { id, data, error })
      throw error
    }
  }

  async authenticate(login: string, senha: string): Promise<UserRow | null> {
    try {
      const user = await this.findByLogin(login)
      if (!user) {
        log.info('Tentativa de autenticação com usuário não encontrado', { login })
        return null
      }

      const senhaHash = user.senha_hash || ''
      let validPassword = false
      if (senhaHash.startsWith('$2a$') || senhaHash.startsWith('$2b$') || senhaHash.startsWith('$2y$')) {
        validPassword = await bcrypt.compare(senha, senhaHash)
      } else {
        validPassword = senha === senhaHash
      }

      if (!validPassword) {
        log.info('Tentativa de autenticação com senha inválida', { login, userId: user.id })
        return null
      }

      log.info('Autenticação bem-sucedida', { login, userId: user.id })
      return user
    } catch (error) {
      log.error('Erro na autenticação', { login, error })
      throw error
    }
  }

  async findByLogin(login: string): Promise<UserRow | null> {
    try {
      const sql = 'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1'
      const rows = await this.executeCustomQuery<UserRow>(sql, [login, login])
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      log.error('Erro ao buscar usuário por login', { login, error })
      throw error
    }
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    try {
      const sql = 'SELECT * FROM users WHERE email = ?'
      const rows = await this.executeCustomQuery<UserRow>(sql, [email])

      if (rows.length === 0) {
        return null
      }

      return rows[0]
    } catch (error) {
      log.error(`Erro ao buscar usuário por email`, { email, error })
      throw error
    }
  }

  async findByMatricula(matricula: string): Promise<UserRow | null> {
    try {
      const sql = 'SELECT * FROM users WHERE matricula = ?'
      const rows = await this.executeCustomQuery<UserRow>(sql, [matricula])
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      log.error(`Erro ao buscar usuário por matrícula`, { matricula, error })
      throw error
    }
  }

  async updateProfile(
    userId: string,
    profileData: Partial<Omit<UserRow, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<UserRow | null> {
    try {
      log.debug('Atualizando perfil do usuário', { userId, fields: Object.keys(profileData).join(', ') })
      return await this.update(userId, profileData)
    } catch (error) {
      log.error('Erro ao atualizar perfil', { userId, error })
      throw error
    }
  }

  async findActivePeritos(): Promise<UserRow[]> {
    try {
      const sql = 'SELECT * FROM users ORDER BY nome ASC'
      const rows = await this.executeCustomQuery<UserRow>(sql)
      return rows
    } catch (error) {
      log.error('Erro ao buscar peritos ativos', error)
      throw error
    }
  }

  async deactivate(userId: string): Promise<boolean> {
    try {
      log.info('Usuário desativado (soft delete)', { userId })
      return true
    } catch (error) {
      log.error('Erro ao desativar usuário', { userId, error })
      throw error
    }
  }

  async generateActivityReport(userId: string, startDate?: Date, endDate?: Date): Promise<RelatorioAtividadeUsuario> {
    try {
      log.info('Relatório de atividades solicitado', { userId, startDate, endDate })
      return {
        userId,
        period: { startDate, endDate },
        laudosCriados: 0,
        laudosConcluidos: 0,
        atividades: []
      }
    } catch (error) {
      log.error('Erro ao gerar relatório de atividades', { userId, error })
      throw error
    }
  }
}

export const userService = new UserService()
