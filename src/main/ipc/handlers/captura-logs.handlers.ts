import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import type { SondaCapturaLogs } from '../../../shared/captura-logs/contratos.js';
import { SONDAS_CAPTURA_LOGS } from '../../../shared/captura-logs/contratos.js';
import { capturaLogsService } from '../../services/captura-logs.service.js';
import { desempenhoService } from '../../services/desempenho.service.js';

function nomeArquivoCaptura(iniciadaEm: string): string {
  const data = new Date(iniciadaEm);
  const preencher = (valor: number): string => String(valor).padStart(2, '0');
  return `captura-logs-${preencher(data.getDate())}${preencher(data.getMonth() + 1)}${data.getFullYear()}-${preencher(data.getHours())}${preencher(data.getMinutes())}.json`;
}

function publicarEstado(): void {
  const estado = capturaLogsService.obterEstado();
  BrowserWindow.getAllWindows().filter(janela => !janela.isDestroyed()).forEach(janela => janela.webContents.send('captura-logs:estado-alterado', estado));
}

function sondasValidas(valor: unknown): valor is SondaCapturaLogs[] {
  return Array.isArray(valor) && valor.length > 0 && valor.every(sonda => typeof sonda === 'string' && SONDAS_CAPTURA_LOGS.includes(sonda as SondaCapturaLogs));
}

async function encerrarDesempenhoSeNecessario(sondas: SondaCapturaLogs[]): Promise<void> {
  if (!sondas.includes('desempenho')) return;
  const estado = await desempenhoService.pararDetalhada();
  BrowserWindow.getAllWindows().filter(janela => !janela.isDestroyed()).forEach(janela => janela.webContents.send('desempenho:perfil-alterado', estado));
}

export function registerCapturaLogsHandlers(): void {
  capturaLogsService.configurarCallbacks(publicarEstado, encerrarDesempenhoSeNecessario);
  ipcMain.handle('captura-logs:estado', async () => ({ success: true, data: capturaLogsService.obterEstado() }));
  ipcMain.handle('captura-logs:iniciar', async (_evento, sondas: unknown) => {
    if (!sondasValidas(sondas)) return { success: false, error: 'Sondas inválidas.' };
    try {
      const estado = await capturaLogsService.iniciar(sondas);
      if (sondas.includes('desempenho')) {
        const desempenho = await desempenhoService.iniciarDetalhada(5 * 60_000);
        BrowserWindow.getAllWindows().filter(janela => !janela.isDestroyed()).forEach(janela => janela.webContents.send('desempenho:perfil-alterado', desempenho));
      }
      publicarEstado();
      return { success: true, data: estado };
    } catch (erro) {
      return { success: false, error: erro instanceof Error && erro.message === 'CAPTURA_ATIVA' ? 'Já existe uma captura ativa.' : 'Não foi possível iniciar a captura.' };
    }
  });
  ipcMain.handle('captura-logs:parar', async () => {
    const sondas = capturaLogsService.obterEstado().ativa?.sondas ?? [];
    await encerrarDesempenhoSeNecessario(sondas);
    const estado = await capturaLogsService.parar();
    publicarEstado();
    return { success: true, data: estado };
  });
  ipcMain.handle('captura-logs:marcar-problema', async () => { await capturaLogsService.marcarProblema(); return { success: true }; });
  ipcMain.handle('captura-logs:listar', async () => ({ success: true, data: await capturaLogsService.listar() }));
  ipcMain.handle('captura-logs:excluir', async (_evento, id: unknown) => {
    if (typeof id !== 'string') return { success: false, error: 'Captura inválida.' };
    await capturaLogsService.excluir(id);
    return { success: true };
  });
  ipcMain.handle('captura-logs:limpar', async () => { await capturaLogsService.limpar(); publicarEstado(); return { success: true }; });
  ipcMain.handle('captura-logs:exportar', async (evento, id: unknown) => {
    if (typeof id !== 'string') return { success: false, error: 'Captura inválida.' };
    const captura = await capturaLogsService.ler(id);
    if (!captura) return { success: false, error: 'Captura não encontrada.' };
    const janela = BrowserWindow.fromWebContents(evento.sender);
    const opcoes = { title: 'Exportar captura de logs', defaultPath: nomeArquivoCaptura(captura.iniciadaEm), filters: [{ name: 'JSON', extensions: ['json'] }] };
    const resultado = janela ? await dialog.showSaveDialog(janela, opcoes) : await dialog.showSaveDialog(opcoes);
    if (resultado.canceled || !resultado.filePath) return { success: true, canceled: true };
    await fs.writeFile(resultado.filePath, JSON.stringify(captura, null, 2), 'utf8');
    return { success: true };
  });
}
