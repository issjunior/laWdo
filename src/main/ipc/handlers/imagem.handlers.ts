import { ipcMain, dialog, BrowserWindow } from 'electron';
import { logError } from '../../utils/logger.js';
import { imagemService } from '../../services/imagem.service.js';

/**
 * Registra handlers IPC para operações de Imagem
 */
export const registerImagemHandlers = (): void => {
  /**
   * Abre diálogo nativo, copia arquivo e registra no banco.
   * Combina seleção + upload em uma única chamada IPC.
   */
  ipcMain.handle('imagem:pickAndUpload', async (_event, laudoId: string) => {
    try {
      if (!laudoId) return { success: false, error: 'ID do laudo inválido' };

      const window = BrowserWindow.getFocusedWindow();
      if (!window) return { success: false, error: 'Nenhuma janela ativa' };

      const result = await dialog.showOpenDialog(window, {
        title: 'Selecionar imagem para o laudo',
        filters: [
          { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Seleção cancelada' };
      }

      const registro = await imagemService.salvar(laudoId, result.filePaths[0]);
      return { success: true, data: { url: registro.url, legenda: registro.legenda, id: registro.id } };
    } catch (error) {
      logError('Erro ao selecionar e enviar imagem', { laudoId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Listar imagens de um laudo
   */
  ipcMain.handle('imagem:findByLaudoId', async (_event, laudoId: string) => {
    try {
      if (!laudoId) return { success: false, error: 'ID do laudo inválido' };
      const imagens = await imagemService.findByLaudoId(laudoId);
      return { success: true, data: imagens };
    } catch (error) {
      logError('Erro ao buscar imagens do laudo', { laudoId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Deletar uma imagem
   */
  ipcMain.handle('imagem:delete', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID da imagem inválido' };
      await imagemService.deletar(id);
      return { success: true };
    } catch (error) {
      logError('Erro ao deletar imagem', { id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });
};
