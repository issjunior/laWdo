import { ipcMain, dialog, BrowserWindow } from 'electron';
import { logInfo, logError } from '../../utils/logger.js';
import { importarDocumento } from '../../services/importacao.service.js';
import path from 'path';

export const registerImportacaoHandlers = (): void => {
  /** Abrir diálogo de arquivo, validar e importar PDF/DOCX */
  ipcMain.handle('template:importarArquivo', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        return { success: false, error: 'Janela não encontrada' };
      }

      const result = await dialog.showOpenDialog(win, {
        title: 'Selecionar documento para importar',
        filters: [
          { name: 'Documentos', extensions: ['pdf', 'docx'] },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'DOCX', extensions: ['docx'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Operação cancelada' };
      }

      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase();

      if (!['.pdf', '.docx'].includes(ext)) {
        return { success: false, error: 'Tipo de arquivo não suportado. Use PDF ou DOCX.' };
      }

      logInfo(`Iniciando importação de arquivo: ${filePath}`);
      const data = await importarDocumento(filePath);

      return { success: true, data };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('Erro ao importar arquivo', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  });
};
