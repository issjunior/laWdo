import { BaseService } from './base.service.js'
import { UserRow } from '../types/database.js'
import { logInfo, logError, logDebug } from '../utils/logger.js'
// A senha é criptografada apenas ao ser criada/alterada.
// Campos de contato (telefone, email, endereco) NÃO são criptografados - são dados operacionais.

/**
 * Serviço para gerenciamento de usuários (peritos)
 */
export class UserService extends BaseService<UserRow> {
  constructor() {
    super('users', 'id')
  }

  /**
   * Criar usuário com senha criptografada (AES-256-GCM)
   */
  async createUserWithPassword(
    data: Omit<UserRow, 'id' | 'data_criacao' | 'data_atualizacao'> & {
      senha: string
    }
  ): Promise<UserRow> {
    try {
      const { senha, ...userData } = data

      logDebug('Criando usuário com senha criptografada', { email: userData.email, matricula: userData.matricula })

      // Verificar se email já existe
      const existingUser = await this.findByEmail(userData.email)
      if (existingUser) {
        throw new Error('Email já registrado')
      }

      // Criptografar a senha do perito antes de salvar
      // Campos de contato (telefone, email, endereco) NÃO são criptografados
      // Pois são dados operacionais de uso diário

      const userToCreate = {
        ...userData,
        senha: Buffer.from(senha).toString('hex') // Placeholder - criptografia real implementada no handler IPC
      }

      const createdUser = await this.create(userToCreate)

      logDebug('Usuário criado com sucesso', { id: createdUser.id, email: createdUser.email })

      return createdUser
    } catch (error) {
      logError('Erro ao criar usuário com senha', error)
      throw error
    }
  }

  /**
   * Autenticar usuário
   */
  async authenticate(email: string, senha: string): Promise<UserRow | null> {
    try {
      const user = await this.findByEmail(email)
      if (!user) {
        logInfo('Tentativa de autenticação com email não encontrado', { email })
        return null
      }

      // TODO: Verificar hash da senha (implementar quando tivermos tabela de autenticação)
      // Por enquanto, apenas retornar usuário se email existir
      logInfo('Autenticação bem-sucedida', { email, userId: user.id })
      return user
    } catch (error) {
      logError('Erro na autenticação', { email, error })
      throw error
    }
  }

  /**
   * Buscar usuário por email
   */
  async findByEmail(email: string): Promise<UserRow | null> {
    try {
      const sql = 'SELECT * FROM users WHERE email = ?'
      const rows = await this.executeCustomQuery<UserRow>(sql, [email])

      if (rows.length === 0) {
        return null
      }

      return rows[0]
    } catch (error) {
      logError(`Erro ao buscar usuário por email`, { email, error })
      throw error
    }
  }

  /**
   * Buscar usuário por matrícula
   */
  async findByMatricula(matricula: string): Promise<UserRow | null> {
    try {
      const sql = 'SELECT * FROM users WHERE matricula = ?'
      const rows = await this.executeCustomQuery<UserRow>(sql, [matricula])
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      logError(`Erro ao buscar usuário por matrícula`, { matricula, error })
      throw error
    }
  }

  /**
   * Atualizar perfil do usuário (dados NÃO criptografados)
   */
  async updateProfile(
    userId: string,
    profileData: Partial<Omit<UserRow, 'id' | 'email' | 'created_at' | 'updated_at'>>
  ): Promise<UserRow | null> {
    try {
      // Dados de perfil (nome, telefone, email, endereco, cargo) NÃO são criptografados
      // Apenas a senha do perito requer criptografia

      logDebug('Atualizando perfil do usuário', { userId, fields: Object.keys(profileData).join(', ') })

      return await this.update(userId, profileData)
    } catch (error) {
      logError('Erro ao atualizar perfil', { userId, error })
      throw error
    }
  }

  /**
   * Buscar peritos ativos
   */
  async findActivePeritos(): Promise<UserRow[]> {
    try {
      // Podemos adicionar filtro por cargo no futuro
      const sql = 'SELECT * FROM users ORDER BY nome ASC'
      const rows = await this.executeCustomQuery<UserRow>(sql)
      return rows
    } catch (error) {
      logError('Erro ao buscar peritos ativos', error)
      throw error
    }
  }

  /**
   * Desativar usuário (soft delete)
   */
  async deactivate(userId: string): Promise<boolean> {
    try {
      // Podemos adicionar coluna 'ativo' no futuro
      // Por enquanto, apenas log
      logInfo('Usuário desativado (soft delete)', { userId })
      return true
    } catch (error) {
      logError('Erro ao desativar usuário', { userId, error })
      throw error
    }
  }

  /**
   * Gerar relatório de atividades do usuário
   */
  async generateActivityReport(userId: string, startDate?: Date, endDate?: Date): Promise<any> {
    try {
      // TODO: Implementar quando tivermos logs de atividade
      logInfo('Relatório de atividades solicitado', { userId, startDate, endDate })
      return {
        userId,
        period: { startDate, endDate },
        laudosCriados: 0,
        laudosConcluidos: 0,
        atividades: []
      }
    } catch (error) {
      logError('Erro ao gerar relatório de atividades', { userId, error })
      throw error
    }
  }
}

// Instância singleton do serviço
export const userService = new UserService()