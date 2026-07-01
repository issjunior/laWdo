import { ipcMain, app } from 'electron'
import { logDebug, logError } from '../../utils/logger.js'
import { userService } from '../../services/user.service.js'
import { sanitizeInput } from '../../security/index.js'
import bcrypt from 'bcrypt'
import fs from 'fs'
import path from 'path'
import type { UserRow } from '../../types/database.js'

type UserUpdatePayload = Partial<Omit<UserRow, 'id' | 'data_criacao'>>

/**
 * Registra handlers IPC para operações de usuário
 */
export const registerUserHandlers = (): void => {
  logDebug('Registrando handlers de usuário...')

  /**
   * Buscar todos os usuários com paginação
   */
  ipcMain.handle('user:findAll', async (event, filters = {}, options = {}) => {
    try {
      logDebug('Buscando todos os usuários', { filters, options })
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

      logDebug('Buscando usuário por ID', { id })
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
      const sanitizedEmail = sanitizeInput(userData.email).toLowerCase()
      const usernameBase = sanitizedEmail.split('@')[0] || 'perito'

      if (!userData.senha || typeof userData.senha !== 'string' || userData.senha.trim().length < 6) {
        return {
          success: false,
          error: 'Senha obrigatória com no mínimo 6 caracteres'
        }
      }
      const senhaHash = await bcrypt.hash(userData.senha, 10)

      // Sanitizar dados de entrada
      const sanitizedData = {
        nome: sanitizeInput(userData.nome),
        email: sanitizedEmail,
        matricula: userData.matricula ? sanitizeInput(userData.matricula) : null,
        telefone: userData.telefone ? sanitizeInput(userData.telefone) : null,
        cargo: userData.cargo ? sanitizeInput(userData.cargo) : null,
        lotacao: userData.lotacao ? sanitizeInput(userData.lotacao) : null,
        username: userData.username ? sanitizeInput(userData.username) : usernameBase,
        senha_hash: senhaHash,
        ativo: 1
      }

      logDebug('Criando novo usuário', { email: sanitizedData.email })
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
      const sanitizedData: UserUpdatePayload = {}
      if (updateData.nome) sanitizedData.nome = sanitizeInput(updateData.nome)
      if (updateData.matricula) sanitizedData.matricula = sanitizeInput(updateData.matricula)
      if (updateData.telefone) sanitizedData.telefone = sanitizeInput(updateData.telefone)
      if (updateData.cargo) sanitizedData.cargo = sanitizeInput(updateData.cargo)
      if (updateData.lotacao) sanitizedData.lotacao = sanitizeInput(updateData.lotacao)

      logDebug('Atualizando usuário', { id })
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

      logDebug('Excluindo usuário', { id })
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
      logDebug('Buscando usuário por email', { email: sanitizedEmail })
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
      logDebug('Buscando peritos ativos')
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
      const sanitizedData: UserUpdatePayload = {}
      if (profileData.nome) sanitizedData.nome = sanitizeInput(profileData.nome)
      if (profileData.matricula) sanitizedData.matricula = sanitizeInput(profileData.matricula)
      if (profileData.telefone) sanitizedData.telefone = sanitizeInput(profileData.telefone)
      if (profileData.cargo) sanitizedData.cargo = sanitizeInput(profileData.cargo)
      if (profileData.lotacao) sanitizedData.lotacao = sanitizeInput(profileData.lotacao)
      if (profileData.email) sanitizedData.email = sanitizeInput(profileData.email).toLowerCase()
      if (profileData.senha && typeof profileData.senha === 'string' && profileData.senha.length >= 6) {
        sanitizedData.senha_hash = await bcrypt.hash(profileData.senha, 10)
      }

      logDebug('Atualizando perfil de usuário', { userId })
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

  /**
   * Upload de avatar do usuário
   */
  ipcMain.handle('user:uploadAvatar', async (event, userId: string, base64Data: string) => {
    try {
      if (!userId || typeof userId !== 'string') {
        return { success: false, error: 'ID de usuário inválido' }
      }
      if (!base64Data || typeof base64Data !== 'string') {
        return { success: false, error: 'Dados da imagem inválidos' }
      }

      const avatarsDir = path.join(app.getPath('userData'), 'avatars')
      if (!fs.existsSync(avatarsDir)) {
        fs.mkdirSync(avatarsDir, { recursive: true })
      }

      const ext = base64Data.startsWith('data:image/png') ? 'png' : 'jpg'
      const fileName = `${userId}.${ext}`
      const filePath = path.join(avatarsDir, fileName)

      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '')
      fs.writeFileSync(filePath, Buffer.from(base64Image, 'base64'))

      const avatarData: UserUpdatePayload = { foto_url: filePath }
      await userService.update(userId, avatarData)

      logDebug('Avatar salvo com sucesso', { userId })
      return { success: true, data: { foto_url: filePath }, message: 'Avatar atualizado com sucesso' }
    } catch (error) {
      logError('Erro ao fazer upload de avatar', { userId, error })
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
    }
  })

  /**
   * Obter avatar do usuário
   */
  ipcMain.handle('user:getAvatar', async (event, userId: string) => {
    try {
      if (!userId || typeof userId !== 'string') {
        return { success: false, error: 'ID de usuário inválido' }
      }

      const user = await userService.findById(userId)
      if (!user || !user.foto_url) {
        return { success: false, error: 'Avatar não encontrado' }
      }

      if (!fs.existsSync(user.foto_url)) {
        return { success: false, error: 'Arquivo de avatar não encontrado' }
      }

      const ext = path.extname(user.foto_url).toLowerCase().replace('.', '') || 'png'
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
      const data = fs.readFileSync(user.foto_url)
      const base64 = `data:${mimeType};base64,${data.toString('base64')}`

      return { success: true, data: { foto_url: base64 } }
    } catch (error) {
      logError('Erro ao obter avatar', { userId, error })
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
    }
  })

  logDebug('Handlers de usuário registrados com sucesso')
}

const verifyAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const registerVerifyPasswordHandler = (): void => {
  ipcMain.handle('user:verifyPassword', async (_event, userId: string, senha: string) => {
    try {
      if (!userId || !senha) return { success: false, valid: false, error: 'Dados inválidos' };

      const now = Date.now();
      const attempts = verifyAttempts.get(userId) || { count: 0, lastAttempt: 0 };
      if (now - attempts.lastAttempt < 30000 && attempts.count >= 3) {
        return { success: false, valid: false, error: 'Muitas tentativas. Aguarde 30 segundos.' };
      }
      if (now - attempts.lastAttempt > 30000) {
        verifyAttempts.set(userId, { count: 1, lastAttempt: now });
      } else {
        verifyAttempts.set(userId, { count: attempts.count + 1, lastAttempt: now });
      }

      const user = await userService.findById(userId);
      if (!user) return { success: false, valid: false, error: 'Usuário não encontrado' };

      let validPassword = false;
      const senhaHash = user.senha_hash || '';
      if (senhaHash.startsWith('$2a$') || senhaHash.startsWith('$2b$') || senhaHash.startsWith('$2y$')) {
        validPassword = await bcrypt.compare(senha, senhaHash);
      } else {
        validPassword = senha === senhaHash;
      }

      if (validPassword) {
        verifyAttempts.delete(userId);
      }

      return { success: true, valid: validPassword };
    } catch (error) {
      logError('Erro ao verificar senha', { userId, error });
      return { success: false, valid: false, error: 'Erro interno' };
    }
  });
};
