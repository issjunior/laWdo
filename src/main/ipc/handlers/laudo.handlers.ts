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

  /**
   * Listar todos os laudos com dados da REP e template
   */
  ipcMain.handle('laudo:findAll', async () => {
    try {
      const laudos = await laudoService.findAllComRep();
      return { success: true, data: laudos };
    } catch (error) {
      logError('Erro ao buscar todos os laudos', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Atualizar conteúdo HTML de um laudo
   */
  ipcMain.handle('laudo:updateConteudo', async (_event, laudoId: string, conteudo: string) => {
    try {
      if (!laudoId) return { success: false, error: 'ID do laudo inválido' };
      if (typeof conteudo !== 'string') return { success: false, error: 'Conteúdo inválido' };
      const laudo = await laudoService.updateConteudo(laudoId, conteudo);
      return { success: true, data: laudo };
    } catch (error) {
      logError('Erro ao atualizar conteúdo do laudo', { laudoId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });
};
