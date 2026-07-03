import { ipcMain } from 'electron'
import { logError } from '../../utils/logger.js'
import { dashboardService } from '../../services/dashboard.service.js'

export const registerDashboardHandlers = (): void => {
  ipcMain.handle('dashboard:resumo', async () => {
    try {
      const data = await dashboardService.obterResumo()
      return { success: true, data }
    } catch (error) {
      logError('Erro ao buscar resumo do dashboard', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  })

  ipcMain.handle('dashboard:projecoes', async () => {
    try {
      const data = await dashboardService.obterProjecoes()
      return { success: true, data }
    } catch (error) {
      logError('Erro ao buscar projeções do dashboard', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  })
}
