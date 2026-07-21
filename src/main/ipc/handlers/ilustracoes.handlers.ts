import { ipcMain, BrowserWindow } from 'electron';
import { logDebug, logError } from '../../utils/logger.js';
import {
  atualizarLegendaImagemLaudo,
  atualizarOrdemImagensLaudo,
  arquivarImagemLaudo,
  disponibilizarImagemLaudo,
  excluirImagemLaudo,
  listarImagensLaudo,
  salvarImagemLaudo,
} from '../../services/imagem-laudo.service.js';
import type { SalvarImagemLaudoEntrada } from '../../../shared/types/imagem-laudo.types.js';

interface IlustracoesHandlerOptions {
  preloadPath: string;
  rendererHtmlPath: string;
  isDev: boolean;
}

let panelWindow: BrowserWindow | null = null;
let mainWindowId: number | null = null;

export function registerIlustracoesHandlers(options: IlustracoesHandlerOptions): void {
  const { preloadPath, rendererHtmlPath, isDev } = options;

  ipcMain.handle('ilustracoes:listar-imagens', async (_event, laudoId: unknown) => {
    try {
      if (typeof laudoId !== 'string') throw new Error('Laudo inválido.')
      return { success: true, data: await listarImagensLaudo(laudoId) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao listar imagens do laudo.' }
    }
  })

  ipcMain.handle('ilustracoes:salvar-imagem', async (_event, laudoId: unknown, entrada: unknown) => {
    try {
      if (typeof laudoId !== 'string' || !entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('Imagem inválida.')
      const dados = entrada as Partial<SalvarImagemLaudoEntrada>
      if (typeof dados.id !== 'string' || typeof dados.nomeArquivo !== 'string' || typeof dados.dataUri !== 'string'
        || typeof dados.legenda !== 'string' || (dados.origem !== 'local' && dados.origem !== 'gdl') || typeof dados.sequencia !== 'number') {
        throw new Error('Dados da imagem inválidos.')
      }
      return { success: true, data: await salvarImagemLaudo(laudoId, dados as SalvarImagemLaudoEntrada) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao salvar imagem do laudo.' }
    }
  })

  ipcMain.handle('ilustracoes:excluir-imagem', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      await excluirImagemLaudo(laudoId, imagemId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao excluir imagem do laudo.' }
    }
  })

  ipcMain.handle('ilustracoes:arquivar-imagem', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      await arquivarImagemLaudo(laudoId, imagemId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao arquivar imagem do laudo.' }
    }
  })

  ipcMain.handle('ilustracoes:disponibilizar-imagem', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      await disponibilizarImagemLaudo(laudoId, imagemId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao disponibilizar imagem do laudo.' }
    }
  })

  ipcMain.handle('ilustracoes:atualizar-legenda', async (_event, laudoId: unknown, imagemId: unknown, legenda: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string' || typeof legenda !== 'string') throw new Error('Legenda inválida.')
      await atualizarLegendaImagemLaudo(laudoId, imagemId, legenda)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar legenda.' }
    }
  })

  ipcMain.handle('ilustracoes:atualizar-ordem', async (_event, laudoId: unknown, ordem: unknown) => {
    try {
      if (typeof laudoId !== 'string' || !Array.isArray(ordem) || ordem.some(item => (
        !item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.sequencia !== 'number'
      ))) throw new Error('Ordem das imagens inválida.')
      await atualizarOrdemImagensLaudo(laudoId, ordem)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar ordem das imagens.' }
    }
  })

  ipcMain.on('ilustracoes:open-panel', (event, laudoId: unknown, tituloLaudo: unknown) => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.focus();
      return;
    }

    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin) mainWindowId = senderWin.id;
    if (typeof laudoId !== 'string' || !laudoId.trim()) {
      logError('Painel de ilustrações não aberto: laudo inválido', new Error('Laudo inválido'));
      return;
    }

    try {
      panelWindow = new BrowserWindow({
        width: 420,
        height: 700,
        minWidth: 320,
        minHeight: 400,
        webPreferences: {
          preload: preloadPath,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
        title: 'Painel de Ilustrações',
        show: false,
      });

      const titulo = typeof tituloLaudo === 'string' ? tituloLaudo.trim() : '';
      const parametros = `laudoId=${encodeURIComponent(laudoId)}${titulo ? `&titulo=${encodeURIComponent(titulo)}` : ''}`;
      const targetUrl = isDev
        ? `http://localhost:3000#/panel-ilustracoes?${parametros}`
        : `file://${rendererHtmlPath}#/panel-ilustracoes?${parametros}`;

      panelWindow.loadURL(targetUrl);

      panelWindow.once('ready-to-show', () => {
        panelWindow?.show();
      });

      panelWindow.on('closed', () => {
        panelWindow = null;
        const main = mainWindowId != null ? BrowserWindow.fromId(mainWindowId) : null;
        if (main && !main.isDestroyed()) {
          main.webContents.send('ilustracoes:panel-closed');
        }
      });

      logDebug('Painel de ilustrações aberto em janela separada');
    } catch (error) {
      logError('Erro ao abrir painel de ilustrações', error);
    }
  });

  ipcMain.on('ilustracoes:close-panel', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.close();
      panelWindow = null;
      logDebug('Painel de ilustrações fechado via IPC');
    }
  });

  ipcMain.on('ilustracoes:sync-to-panel', (_event, data) => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send('ilustracoes:state-sync', data);
    }
  });

  ipcMain.on('ilustracoes:panel-action', (_event, action, ...args) => {
    const target = mainWindowId != null ? BrowserWindow.fromId(mainWindowId) : null;
    if (target && !target.isDestroyed()) {
      target.webContents.send('ilustracoes:panel-action', action, ...args);
    }
  });
}
