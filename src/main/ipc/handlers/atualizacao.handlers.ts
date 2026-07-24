import { dialog, ipcMain, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { atualizacaoService } from '../../services/atualizacao.service.js';

function respostaErro(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : 'Erro inesperado na atualização.';
  return { success: false, data: atualizacaoService.obterEstado(), error: mensagem };
}

const autorizacoesPendentes = new Map<string, { webContentsId: number; resolver: (autorizado: boolean) => void }>();

function solicitarAutorizacaoReinicio(webContents: WebContents): Promise<void> {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => {
      autorizacoesPendentes.delete(id);
      reject(new Error('A confirmação de fechamento seguro expirou.'));
    }, 15_000);
    autorizacoesPendentes.set(id, {
      webContentsId: webContents.id,
      resolver: autorizado => {
        clearTimeout(temporizador);
        autorizacoesPendentes.delete(id);
        if (autorizado) resolve();
        else reject(new Error('Existem alterações não salvas. Salve ou descarte-as antes de atualizar.'));
      },
    });
    webContents.send('atualizacao:solicitar-reinicio', id);
  });
}

export function registerAtualizacaoHandlers(): void {
  ipcMain.handle('atualizacao:estado', () => ({ success: true, data: atualizacaoService.obterEstado() }));
  ipcMain.handle('atualizacao:verificar', async () => {
    try { return { success: true, data: await atualizacaoService.verificar(true) }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:baixar', async () => {
    try { return { success: true, data: await atualizacaoService.baixar() }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:adiar', () => {
    try { return { success: true, data: atualizacaoService.adiar() }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:preparar-reinicio', async evento => {
    try {
      return { success: true, data: await atualizacaoService.prepararReinicio(() => solicitarAutorizacaoReinicio(evento.sender)) };
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:instalar-agora', async evento => {
    try {
      return { success: true, data: await atualizacaoService.instalarAgora(() => solicitarAutorizacaoReinicio(evento.sender)) };
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:agendar', () => {
    try { return { success: true, data: atualizacaoService.agendarParaProximaInicializacao() }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:selecionar-offline', async _evento => {
    try {
      const selecao = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Manifesto de atualização', extensions: ['json'] }] });
      if (selecao.canceled || selecao.filePaths.length !== 1) return { success: true, data: atualizacaoService.obterEstado() };
      return { success: true, data: await atualizacaoService.carregarAtualizacaoOffline(selecao.filePaths[0]) };
    } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:responder-reinicio', (evento, id: unknown, autorizado: unknown) => {
    if (typeof id !== 'string' || typeof autorizado !== 'boolean') return { success: false };
    const pendencia = autorizacoesPendentes.get(id);
    if (!pendencia || pendencia.webContentsId !== evento.sender.id) return { success: false };
    pendencia.resolver(autorizado);
    return { success: true };
  });
}
