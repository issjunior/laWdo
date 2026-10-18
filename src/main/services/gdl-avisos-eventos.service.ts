import { BrowserWindow } from 'electron';

export function notificarAvisosGdlAlterados(reiniciar = false): void {
  for (const janela of BrowserWindow.getAllWindows()) {
    if (!janela.webContents.isDestroyed()) janela.webContents.send('gdl:avisos-alterados', reiniciar);
  }
}
