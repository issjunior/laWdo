import { ipcMain } from 'electron'
import { logError } from '../../utils/logger.js'
import { dashboardService } from '../../services/dashboard.service.js'
import type { DashboardConsultaLaudosEntrada, DashboardProducaoLaudosEntrada, DashboardTipoDataConsulta } from '../../../types/dashboard.js'

const tiposDataValidos: readonly DashboardTipoDataConsulta[] = ['criacao', 'alteracao', 'conclusao', 'entrega']

const dataValida = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(`${valor}T00:00:00`))

const textoOpcional = (valor: unknown): string | undefined =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : undefined

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

  ipcMain.handle('dashboard:consultar-laudos', async (_event, entrada: unknown) => {
    try {
      if (typeof entrada !== 'object' || entrada === null) throw new Error('Filtros inválidos')
      const filtros = entrada as Record<string, unknown>
      if (!tiposDataValidos.includes(filtros.tipoData as DashboardTipoDataConsulta)) throw new Error('Tipo de data inválido')
      if (filtros.dataInicial !== undefined && !dataValida(filtros.dataInicial)) throw new Error('Data inicial inválida')
      if (filtros.dataFinal !== undefined && !dataValida(filtros.dataFinal)) throw new Error('Data final inválida')
      if (dataValida(filtros.dataInicial) && dataValida(filtros.dataFinal) && filtros.dataInicial > filtros.dataFinal) {
        throw new Error('A data inicial não pode ser posterior à data final')
      }
      const pagina = typeof filtros.pagina === 'number' && Number.isInteger(filtros.pagina) ? filtros.pagina : undefined
      const tamanhoPagina = typeof filtros.tamanhoPagina === 'number' && Number.isInteger(filtros.tamanhoPagina) ? filtros.tamanhoPagina : undefined
      if (pagina !== undefined && pagina < 1) throw new Error('Página inválida')
      if (tamanhoPagina !== undefined && (tamanhoPagina < 1 || tamanhoPagina > 100)) throw new Error('Tamanho de página inválido')
      const data = await dashboardService.consultarLaudos({
        busca: textoOpcional(filtros.busca), tipoData: filtros.tipoData as DashboardTipoDataConsulta,
        dataInicial: filtros.dataInicial as string | undefined, dataFinal: filtros.dataFinal as string | undefined, pagina, tamanhoPagina,
      } satisfies DashboardConsultaLaudosEntrada)
      return { success: true, data }
    } catch (error) {
      logError('Erro ao consultar laudos no dashboard', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  })

  ipcMain.handle('dashboard:cronologia-laudo', async (_event, laudoId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || !laudoId.trim()) throw new Error('Laudo inválido')
      const data = await dashboardService.obterCronologiaLaudo(laudoId)
      return { success: true, data }
    } catch (error) {
      logError('Erro ao consultar cronologia do laudo no dashboard', error)
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
    }
  })

  ipcMain.handle('dashboard:producao-laudos', async (_event, entrada: unknown) => {
    try {
      if (entrada !== undefined && (typeof entrada !== 'object' || entrada === null)) throw new Error('Filtros inválidos')
      const filtros = (entrada ?? {}) as Record<string, unknown>
      if (filtros.dataInicial !== undefined && !dataValida(filtros.dataInicial)) throw new Error('Data inicial inválida')
      if (filtros.dataFinal !== undefined && !dataValida(filtros.dataFinal)) throw new Error('Data final inválida')
      if (dataValida(filtros.dataInicial) && dataValida(filtros.dataFinal) && filtros.dataInicial > filtros.dataFinal) {
        throw new Error('A data inicial não pode ser posterior à data final')
      }
      const data = await dashboardService.obterProducaoLaudos({
        tipoExameId: textoOpcional(filtros.tipoExameId),
        dataInicial: filtros.dataInicial as string | undefined,
        dataFinal: filtros.dataFinal as string | undefined,
      } satisfies DashboardProducaoLaudosEntrada)
      return { success: true, data }
    } catch (error) {
      logError('Erro ao consultar produção de laudos no dashboard', error)
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
    }
  })
}
