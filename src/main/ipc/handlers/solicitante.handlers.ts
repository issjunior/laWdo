import { ipcMain } from 'electron'
import { logDebug, logError } from '../../utils/logger.js'
import { auditDelete } from '../../services/audit-log.service.js'
import { solicitanteService } from '../../services/solicitante.service.js'
import { sanitizeInput } from '../../security/index.js'

/**
 * Registra handlers IPC para operações de solicitante
 */
export const registerSolicitanteHandlers = (): void => {
  logDebug('Registrando handlers de solicitante...')

  /**
   * Buscar todos os solicitantes com paginação
   */
  ipcMain.handle('solicitante:findAll', async (event, filters = {}, options = {}) => {
    try {
      logDebug('Buscando todos os solicitantes', { filters, options })
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

      logDebug('Buscando solicitante por ID', { id })
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

      logDebug('Criando novo solicitante', { nome: sanitizedData.nome })
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
      if (updateData.nome !== undefined) sanitizedData.nome = sanitizeInput(updateData.nome)
      if (updateData.tipo !== undefined) sanitizedData.tipo = sanitizeInput(updateData.tipo ?? '')
      if (updateData.endereco !== undefined) sanitizedData.endereco = sanitizeInput(updateData.endereco ?? '')
      if (updateData.telefone !== undefined) sanitizedData.telefone = sanitizeInput(updateData.telefone ?? '')
      if (updateData.email !== undefined) sanitizedData.email = sanitizeInput(updateData.email ?? '')
      if (updateData.ativo !== undefined) sanitizedData.ativo = updateData.ativo ? 1 : 0

      logDebug('Atualizando solicitante', { id })
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
   * Ativar/desativar solicitante
   */
  ipcMain.handle('solicitante:toggleStatus', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      // Buscar solicitante atual
      const current = await solicitanteService.findById(id)
      if (!current) {
        return {
          success: false,
          error: 'Solicitante não encontrado'
        }
      }

      // Inverter status
      const novoStatus = !current.ativo
      const sanitizedData = {
        ativo: novoStatus
      }

      logDebug(`Trocando status do solicitante ${id} para ${novoStatus ? 'ativo' : 'inativo'}`)
      const updated = await solicitanteService.updateSolicitante(id, sanitizedData)

      return {
        success: true,
        data: updated,
        message: `Solicitante ${novoStatus ? 'ativado' : 'desativado'} com sucesso`
      }
    } catch (error) {
      logError('Erro ao trocar status do solicitante', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar todos os solicitantes (ativos e inativos)
   */
  ipcMain.handle('solicitante:findAllSemFiltroStatus', async (event, filters = {}, options = {}) => {
    try {
      logDebug('Buscando todos os solicitantes (sem filtro de status)', { filters, options })
      const solicitantes = await solicitanteService.findAllSemFiltroStatus(
        { tipo: filters.tipo },
        { limit: options.limit, offset: options.offset }
      );
      return {
        success: true,
        data: solicitantes,
        total: solicitantes.length
      }
    } catch (error) {
      logError('Erro ao buscar todos os solicitantes', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  });

  /**
   * Desativar solicitante (soft delete - apenas altera status ativo para 0)
   */
  ipcMain.handle('solicitante:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logDebug('Desativando solicitante (soft delete)', { id })
      await solicitanteService.desativarSolicitante(id)
      auditDelete('', 'solicitantes', id, `Solicitante ${id} desativado`)

      return {
        success: true,
        message: 'Solicitante desativado com sucesso'
      }
    } catch (error) {
      logError('Erro ao desativar solicitante', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Excluir permanentemente o solicitante (hard delete)
   */
  ipcMain.handle('solicitante:hardDelete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logDebug('Excluindo permanentemente o solicitante (hard delete)', { id })
      const result = await solicitanteService.delete(id)

      if (!result) {
        return {
          success: false,
          error: 'Solicitante não encontrado ou erro ao excluir'
        }
      }

      return {
        success: true,
        message: 'Solicitante excluído permanentemente com sucesso'
      }
    } catch (error) {
      logError('Erro ao excluir permanentemente o solicitante', { id, error })
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
      logDebug('Buscando solicitantes por tipo', { tipo: sanitizedTipo })
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
      logDebug('Buscando tipos de solicitantes')
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
      logDebug('Buscando solicitantes ativos', { filters, options })
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

  logDebug('Handlers de solicitante registrados com sucesso')
}