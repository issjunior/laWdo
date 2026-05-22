import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import { logInfo, logError } from '../../utils/logger.js';

interface IlustracoesHandlerOptions {
  preloadPath: string;
  rendererHtmlPath: string;
  isDev: boolean;
}

let panelWindow: BrowserWindow | null = null;
let mainWindowId: number | null = null;

export function registerIlustracoesHandlers(options: IlustracoesHandlerOptions): void {
  const { preloadPath, rendererHtmlPath, isDev } = options;

  ipcMain.on('ilustracoes:open-panel', (event) => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.focus();
      return;
    }

    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin) mainWindowId = senderWin.id;

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

      const targetUrl = isDev
        ? 'http://localhost:3000#/panel-ilustracoes'
        : `file://${rendererHtmlPath}#/panel-ilustracoes`;

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

      logInfo('Painel de ilustrações aberto em janela separada');
    } catch (error) {
      logError('Erro ao abrir painel de ilustrações', error);
    }
  });

  ipcMain.on('ilustracoes:close-panel', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.close();
      panelWindow = null;
      logInfo('Painel de ilustrações fechado via IPC');
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
