import { ipcMain, shell } from 'electron';
import { authSessaoService } from '../../services/auth-sessao.service.js';
import { getLogger } from '../../utils/logger.js';

const log = getLogger('ia');

const URL_NOTEBOOK_LM = 'https://notebook.google.com/';

export function registerNotebookLmHandlers(): void {
  ipcMain.handle('notebooklm:abrir', async event => {
    authSessaoService.exigir(event.sender.id);

    try {
      await shell.openExternal(URL_NOTEBOOK_LM);
      return { success: true };
    } catch (erro) {
      log.error('Não foi possível abrir o NotebookLM no navegador padrão.', { erro });
      return { success: false, error: 'Não foi possível abrir o NotebookLM no navegador padrão.' };
    }
  });
}
