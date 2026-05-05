import { ipcMain } from 'electron'
import { logInfo, logError } from '../../utils/logger.js'
import { userService } from '../../services/user.service.js'
import { sanitizeInput } from '../../security/index.js'

/**
 * Registra handlers IPC para operações de usuário
 */
export const registerUserHandlers = (): void => {
  logInfo('Registrando handlers de usuário...')

  /**
   * Buscar todos os usuários com paginação
   */
  ipcMain.handle('user:findAll', async (event, filters = {}, options = {}) => {
    try {
      logInfo('Buscando todos os usuários', { filters, options })
      const users = await userService.findAll(filters, options)
      return {
        success: true,
        data: users,
        total: users.length
      }
    } catch (error) {
      logError('Erro ao buscar usuários', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar usuário por ID
   */
  ipcMain.handle('user:findById', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logInfo('Buscando usuário por ID', { id })
      const user = await userService.findById(id)

      if (!user) {
        return {
          success: false,
          error: 'Usuário não encontrado'
        }
      }

      return {
        success: true,
        data: user
      }
    } catch (error) {
      logError('Erro ao buscar usuário por ID', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Criar novo usuário
   */
  ipcMain.handle('user:create', async (event, userData) => {
    try {
      // Sanitizar dados de entrada
      const sanitizedData = {
        nome: sanitizeInput(userData.nome),
        email: sanitizeInput(userData.email),
        matricula: userData.matricula ? sanitizeInput(userData.matricula) : null,
        telefone: userData.telefone ? sanitizeInput(userData.telefone) : null,
        cargo: userData.cargo ? sanitizeInput(userData.cargo) : null
      }

      logInfo('Criando novo usuário', { email: sanitizedData.email })
      const user = await userService.create(sanitizedData)

      return {
        success: true,
        data: user,
        message: 'Usuário criado com sucesso'
      }
    } catch (error) {
      logError('Erro ao criar usuário', { userData, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Atualizar usuário
   */
  ipcMain.handle('user:update', async (event, id: string, updateData) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      // Sanitizar dados de entrada
      const sanitizedData: any = {}
      if (updateData.nome) sanitizedData.nome = sanitizeInput(updateData.nome)
      if (updateData.matricula) sanitizedData.matricula = sanitizeInput(updateData.matricula)
      if (updateData.telefone) sanitizedData.telefone = sanitizeInput(updateData.telefone)
      if (updateData.cargo) sanitizedData.cargo = sanitizeInput(updateData.cargo)

      logInfo('Atualizando usuário', { id })
      const updatedUser = await userService.update(id, sanitizedData)

      if (!updatedUser) {
        return {
          success: false,
          error: 'Usuário não encontrado'
        }
      }

      return {
        success: true,
        data: updatedUser,
        message: 'Usuário atualizado com sucesso'
      }
    } catch (error) {
      logError('Erro ao atualizar usuário', { id, updateData, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Excluir usuário
   */
  ipcMain.handle('user:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logInfo('Excluindo usuário', { id })
      const deleted = await userService.delete(id)

      if (!deleted) {
        return {
          success: false,
          error: 'Usuário não encontrado'
        }
      }

      return {
        success: true,
        message: 'Usuário excluído com sucesso'
      }
    } catch (error) {
      logError('Erro ao excluir usuário', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar usuário por email
   */
  ipcMain.handle('user:findByEmail', async (event, email: string) => {
    try {
      if (!email || typeof email !== 'string') {
        return {
          success: false,
          error: 'Email inválido'
        }
      }

      const sanitizedEmail = sanitizeInput(email)
      logInfo('Buscando usuário por email', { email: sanitizedEmail })
      const user = await userService.findByEmail(sanitizedEmail)

      if (!user) {
        return {
          success: false,
          error: 'Usuário não encontrado'
        }
      }

      return {
        success: true,
        data: user
      }
    } catch (error) {
      logError('Erro ao buscar usuário por email', { email, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar peritos ativos
   */
  ipcMain.handle('user:findActivePeritos', async () => {
    try {
      logInfo('Buscando peritos ativos')
      const peritos = await userService.findActivePeritos()

      return {
        success: true,
        data: peritos,
        total: peritos.length
      }
    } catch (error) {
      logError('Erro ao buscar peritos ativos', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Atualizar perfil de usuário
   */
  ipcMain.handle('user:updateProfile', async (event, userId: string, profileData) => {
    try {
      if (!userId || typeof userId !== 'string') {
        return {
          success: false,
          error: 'ID de usuário inválido'
        }
      }

      // Sanitizar dados
      const sanitizedData: any = {}
      if (profileData.nome) sanitizedData.nome = sanitizeInput(profileData.nome)
      if (profileData.matricula) sanitizedData.matricula = sanitizeInput(profileData.matricula)
      if (profileData.telefone) sanitizedData.telefone = sanitizeInput(profileData.telefone)
      if (profileData.cargo) sanitizedData.cargo = sanitizeInput(profileData.cargo)

      logInfo('Atualizando perfil de usuário', { userId })
      const updatedProfile = await userService.updateProfile(userId, sanitizedData)

      if (!updatedProfile) {
        return {
          success: false,
          error: 'Usuário não encontrado'
        }
      }

      return {
        success: true,
        data: updatedProfile,
        message: 'Perfil atualizado com sucesso'
      }
    } catch (error) {
      logError('Erro ao atualizar perfil', { userId, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  logInfo('Handlers de usuário registrados com sucesso')
}