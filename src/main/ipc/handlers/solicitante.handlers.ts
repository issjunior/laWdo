import { ipcMain } from 'electron'
import { logInfo, logError } from '../../utils/logger'
import { solicitanteService } from '../../services/solicitante.service'
import { sanitizeInput } from '../../security'

/**
 * Registra handlers IPC para operações de solicitante
 */
export const registerSolicitanteHandlers = (): void => {
  logInfo('Registrando handlers de solicitante...')

  /**
   * Buscar todos os solicitantes com paginação
   */
  ipcMain.handle('solicitante:findAll', async (event, filters = {}, options = {}) => {
    try {
      logInfo('Buscando todos os solicitantes', { filters, options })
      const solicitantes = await solicitanteService.findAll(filters, options)
      return {
        success: true,
        data: solicitantes,
        total: solicitantes.length
      }
    } catch (error) {
      logError('Erro ao buscar solicitantes', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar solicitante por ID
   */
  ipcMain.handle('solicitante:findById', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logInfo('Buscando solicitante por ID', { id })
      const solicitante = await solicitanteService.findById(id)

      if (!solicitante) {
        return {
          success: false,
          error: 'Solicitante não encontrado'
        }
      }

      return {
        success: true,
        data: solicitante
      }
    } catch (error) {
      logError('Erro ao buscar solicitante por ID', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Criar novo solicitante
   */
  ipcMain.handle('solicitante:create', async (event, solicitanteData) => {
    try {
      // Sanitizar dados de entrada
      const sanitizedData = {
        nome: sanitizeInput(solicitanteData.nome),
        tipo: sanitizeInput(solicitanteData.tipo),
        endereco: solicitanteData.endereco ? sanitizeInput(solicitanteData.endereco) : null,
        telefone: solicitanteData.telefone ? sanitizeInput(solicitanteData.telefone) : null,
        email: solicitanteData.email ? sanitizeInput(solicitanteData.email) : null
      }

      logInfo('Criando novo solicitante', { nome: sanitizedData.nome })
      const solicitante = await solicitanteService.createSolicitante(sanitizedData)

      return {
        success: true,
        data: solicitante,
        message: 'Solicitante criado com sucesso'
      }
    } catch (error) {
      logError('Erro ao criar solicitante', { solicitanteData, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Atualizar solicitante
   */
  ipcMain.handle('solicitante:update', async (event, id: string, updateData) => {
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
      if (updateData.tipo) sanitizedData.tipo = sanitizeInput(updateData.tipo)
      if (updateData.endereco) sanitizedData.endereco = sanitizeInput(updateData.endereco)
      if (updateData.telefone) sanitizedData.telefone = sanitizeInput(updateData.telefone)
      if (updateData.email) sanitizedData.email = sanitizeInput(updateData.email)

      logInfo('Atualizando solicitante', { id })
      const updatedSolicitante = await solicitanteService.updateSolicitante(id, sanitizedData)

      if (!updatedSolicitante) {
        return {
          success: false,
          error: 'Solicitante não encontrado'
        }
      }

      return {
        success: true,
        data: updatedSolicitante,
        message: 'Solicitante atualizado com sucesso'
      }
    } catch (error) {
      logError('Erro ao atualizar solicitante', { id, updateData, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Excluir solicitante
   */
  ipcMain.handle('solicitante:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logInfo('Excluindo solicitante', { id })
      const deleted = await solicitanteService.delete(id)

      if (!deleted) {
        return {
          success: false,
          error: 'Solicitante não encontrado'
        }
      }

      return {
        success: true,
        message: 'Solicitante excluído com sucesso'
      }
    } catch (error) {
      logError('Erro ao excluir solicitante', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar solicitantes por tipo
   */
  ipcMain.handle('solicitante:findByTipo', async (event, tipo: string) => {
    try {
      if (!tipo || typeof tipo !== 'string') {
        return {
          success: false,
          error: 'Tipo inválido'
        }
      }

      const sanitizedTipo = sanitizeInput(tipo)
      logInfo('Buscando solicitantes por tipo', { tipo: sanitizedTipo })
      const solicitantes = await solicitanteService.findByTipo(sanitizedTipo)

      return {
        success: true,
        data: solicitantes,
        total: solicitantes.length
      }
    } catch (error) {
      logError('Erro ao buscar solicitantes por tipo', { tipo, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar todos os tipos de solicitantes
   */
  ipcMain.handle('solicitante:findTipos', async () => {
    try {
      logInfo('Buscando tipos de solicitantes')
      const tipos = await solicitanteService.findTipos()

      return {
        success: true,
        data: tipos,
        total: tipos.length
      }
    } catch (error) {
      logError('Erro ao buscar tipos de solicitantes', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar solicitantes ativos
   */
  ipcMain.handle('solicitante:findAtivos', async (event, filters = {}, options = {}) => {
    try {
      logInfo('Buscando solicitantes ativos', { filters, options })
      const solicitantes = await solicitanteService.findAtivos(filters, options)

      return {
        success: true,
        data: solicitantes,
        total: solicitantes.length
      }
    } catch (error) {
      logError('Erro ao buscar solicitantes ativos', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  logInfo('Handlers de solicitante registrados com sucesso')
}