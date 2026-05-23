import { ipcMain } from 'electron'
import { logInfo, logError } from '../../utils/logger.js'
import { tipoExameService } from '../../services/tipo-exame.service.js'
import { sanitizeInput } from '../../security/index.js'

/**
 * Registra handlers IPC para operações de tipo de exame
 */
export const registerTipoExameHandlers = (): void => {
  logInfo('Registrando handlers de tipo de exame...')

  /**
   * Buscar todos os tipos de exame
   */
  ipcMain.handle('tipo-exame:findAll', async () => {
    try {
      logInfo('Buscando todos os tipos de exame')
      const tiposExame = await tipoExameService.findAllOrdered()
      return {
        success: true,
        data: tiposExame,
        total: tiposExame.length
      }
    } catch (error) {
      logError('Erro ao buscar tipos de exame', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar tipo de exame por ID
   */
  ipcMain.handle('tipo-exame:findById', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logInfo('Buscando tipo de exame por ID', { id })
      const tipoExame = await tipoExameService.findById(id)

      if (!tipoExame) {
        return {
          success: false,
          error: 'Tipo de exame não encontrado'
        }
      }

      return {
        success: true,
        data: tipoExame
      }
    } catch (error) {
      logError('Erro ao buscar tipo de exame por ID', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Criar novo tipo de exame
   */
  ipcMain.handle('tipo-exame:create', async (event, tipoExameData) => {
    try {
      // Sanitizar dados de entrada
      const sanitizedData = {
        codigo: sanitizeInput(tipoExameData.codigo),
        nome: sanitizeInput(tipoExameData.nome),
        descricao: tipoExameData.descricao ? sanitizeInput(tipoExameData.descricao) : null
      }

      logInfo('Criando novo tipo de exame', { nome: sanitizedData.nome })
      const tipoExame = await tipoExameService.create(sanitizedData)

      return {
        success: true,
        data: tipoExame,
        message: 'Tipo de exame criado com sucesso'
      }
    } catch (error) {
      logError('Erro ao criar tipo de exame', { tipoExameData, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Atualizar tipo de exame
   */
  ipcMain.handle('tipo-exame:update', async (event, id: string, updateData) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      // Sanitizar dados de entrada
      const sanitizedData: any = {}
      if (updateData.codigo) sanitizedData.codigo = sanitizeInput(updateData.codigo)
      if (updateData.nome) sanitizedData.nome = sanitizeInput(updateData.nome)
      if (updateData.descricao !== undefined) sanitizedData.descricao = sanitizeInput(updateData.descricao)

      logInfo('Atualizando tipo de exame', { id })
      const updatedTipoExame = await tipoExameService.update(id, sanitizedData)

      if (!updatedTipoExame) {
        return {
          success: false,
          error: 'Tipo de exame não encontrado'
        }
      }

      return {
        success: true,
        data: updatedTipoExame,
        message: 'Tipo de exame atualizado com sucesso'
      }
    } catch (error) {
      logError('Erro ao atualizar tipo de exame', { id, updateData, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Excluir tipo de exame
   */
  ipcMain.handle('tipo-exame:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logInfo('Excluindo tipo de exame', { id })
      const deleted = await tipoExameService.delete(id)

      if (!deleted) {
        return {
          success: false,
          error: 'Tipo de exame não encontrado'
        }
      }

      return {
        success: true,
        message: 'Tipo de exame excluído com sucesso'
      }
    } catch (error) {
      logError('Erro ao excluir tipo de exame', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Ativar/desativar tipo de exame (toggle)
   */
  ipcMain.handle('tipo-exame:toggleStatus', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      const tipo = await tipoExameService.findById(id)
      if (!tipo) {
        return {
          success: false,
          error: 'Tipo de exame não encontrado'
        }
      }

      const updated = await tipoExameService.toggleStatus(id)

      return {
        success: true,
        data: updated,
        message: updated?.ativo ? 'Tipo de exame ativado com sucesso!' : 'Tipo de exame desativado com sucesso!'
      }
    } catch (error) {
      logError('Erro ao alternar status do tipo de exame', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar todos os tipos de exame (ativos e inativos)
   */
  ipcMain.handle('tipo-exame:findAllSemFiltroStatus', async () => {
    try {
      logInfo('Buscando todos os tipos de exame (sem filtro de status)')
      const tiposExame = await tipoExameService.findAllSemFiltroStatus()
      return {
        success: true,
        data: tiposExame,
        total: tiposExame.length
      }
    } catch (error) {
      logError('Erro ao buscar tipos de exame sem filtro', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Buscar tipos de exame com template padrão
   */
  ipcMain.handle('tipo-exame:findComTemplate', async () => {
    try {
      logInfo('Buscando tipos de exame com template padrão')
      const tiposExame = await tipoExameService.findComTemplate()

      return {
        success: true,
        data: tiposExame,
        total: tiposExame.length
      }
    } catch (error) {
      logError('Erro ao buscar tipos de exame com template', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Atualizar template padrão
   */
  ipcMain.handle('tipo-exame:atualizarTemplate', async (event, id: string, template: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      const sanitizedTemplate = sanitizeInput(template)
      logInfo('Atualizando template padrão', { id })
      const updated = await tipoExameService.atualizarTemplate(id, sanitizedTemplate)

      if (!updated) {
        return {
          success: false,
          error: 'Tipo de exame não encontrado'
        }
      }

      return {
        success: true,
        data: updated,
        message: 'Template atualizado com sucesso'
      }
    } catch (error) {
      logError('Erro ao atualizar template', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  /**
   * Obter template padrão
   */
  ipcMain.handle('tipo-exame:obterTemplate', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'ID inválido'
        }
      }

      logInfo('Obtendo template padrão', { id })
      const template = await tipoExameService.obterTemplate(id)

      return {
        success: true,
        data: { template },
        hasTemplate: template !== null
      }
    } catch (error) {
      logError('Erro ao obter template', { id, error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  })

  logInfo('Handlers de tipo de exame registrados com sucesso')
}