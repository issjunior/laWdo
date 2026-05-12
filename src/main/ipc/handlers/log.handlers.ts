import { ipcMain } from 'electron';
import { getAllLogs, clearAllLogs, logInfo, logError } from '../../utils/logger.js';

/**
 * Registra handlers IPC para logs do sistema (leitura e limpeza)
 */
export const registerLogSystemHandlers = (): void => {
  logInfo('Registrando handlers de logs do sistema...');

  // Listar todos os logs
  ipcMain.handle('log:listar', async () => {
    try {
      const logs = getAllLogs();
      return { success: true, data: logs };
    } catch (error) {
      logError('Erro ao listar logs do sistema', error);
      return { success: false, error: String(error) };
    }
  });

  // Limpar todos os logs
  ipcMain.handle('log:limpar', async () => {
    try {
      const result = clearAllLogs();
      return result;
    } catch (error) {
      logError('Erro ao limpar logs do sistema', error);
      return { success: false, error: String(error) };
    }
  });

  logInfo('Handlers de logs do sistema registrados');
};
