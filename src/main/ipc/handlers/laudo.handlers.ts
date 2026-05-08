import { ipcMain } from 'electron';
import { logError } from '../../utils/logger.js';
import { laudoService } from '../../services/laudo.service.js';

/**
 * Registra handlers IPC para operações de Laudo
 */
export const registerLaudoHandlers = (): void => {
  /**
   * Buscar laudo por REP
   */
  ipcMain.handle('laudo:findByRepId', async (_event, repId: string) => {
    try {
      if (!repId) return { success: false, error: 'ID da REP inválido' };
      const laudo = await laudoService.findByRepId(repId);
      return { success: true, data: laudo };
    } catch (error) {
      logError('Erro ao buscar laudo por REP', { repId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });
};
