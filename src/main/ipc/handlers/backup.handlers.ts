import { ipcMain, dialog, BrowserWindow } from 'electron';
import { logError } from '../../utils/logger.js';
import { criarBackup, restaurarBackup } from '../../services/backup.service.js';

/**
 * Registra handlers IPC para Backup e Restauração
 */
export const registerBackupHandlers = (): void => {
  /**
   * Abre diálogo de salvamento, cria ZIP com banco + imagens e salva no caminho escolhido.
   */
  ipcMain.handle('backup:criar', async () => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) return { success: false, error: 'Nenhuma janela ativa' };

      const result = await dialog.showSaveDialog(window, {
        title: 'Salvar backup do laWdo',
        defaultPath: `laudo_pericial_backup_${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.zip`,
        filters: [{ name: 'Arquivo ZIP', extensions: ['zip'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Operação cancelada pelo usuário' };
      }

      const r = await criarBackup(result.filePath);
      return r;
    } catch (error) {
      logError('Erro no handler backup:criar', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Abre diálogo de seleção de arquivo ZIP e restaura banco + imagens.
   */
  ipcMain.handle('backup:restaurar', async () => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) return { success: false, error: 'Nenhuma janela ativa' };

      const result = await dialog.showOpenDialog(window, {
        title: 'Selecionar arquivo de backup',
        filters: [{ name: 'Arquivo ZIP', extensions: ['zip'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Operação cancelada pelo usuário' };
      }

      const r = await restaurarBackup(result.filePaths[0]);
      return r;
    } catch (error) {
      logError('Erro no handler backup:restaurar', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });
};
