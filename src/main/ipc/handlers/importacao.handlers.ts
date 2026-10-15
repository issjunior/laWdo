import { ipcMain, dialog, BrowserWindow } from 'electron';
import { logDebug, logError } from '../../utils/logger.js';
import { importarDocumento } from '../../services/importacao.service.js';
import path from 'path';
import type { RespostaImportacaoTemplate } from '../../../shared/types/importacao-template.types.js';

export const registerImportacaoHandlers = (): void => {
  /** Abrir diálogo de arquivo, validar e importar PDF/DOCX/ODT */
  ipcMain.handle('template:importarArquivo', async (event): Promise<RespostaImportacaoTemplate> => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        return { success: false, error: 'Janela não encontrada' };
      }

      const result = await dialog.showOpenDialog(win, {
        title: 'Selecionar documento para importar',
        filters: [
          { name: 'Documentos', extensions: ['pdf', 'docx', 'odt'] },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'DOCX', extensions: ['docx'] },
          { name: 'ODT', extensions: ['odt'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelado: true };
      }

      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase();

      if (!['.pdf', '.docx', '.odt'].includes(ext)) {
        return { success: false, error: 'Tipo de arquivo não suportado. Use PDF, DOCX ou ODT.' };
      }

      logDebug(`Iniciando importação de arquivo: ${filePath}`);
      const data = await importarDocumento(filePath);

      return { success: true, data };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('Erro ao importar arquivo', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  });
};
