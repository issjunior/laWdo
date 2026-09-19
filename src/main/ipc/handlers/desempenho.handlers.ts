import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import type { EstadoCapturaDesempenho, EventoDesempenhoEntrada } from '../../../shared/desempenho/contratos.js';
import { desempenhoService } from '../../services/desempenho.service.js';

const PADRAO_IDENTIFICADOR = /^[a-z0-9:_-]{1,100}$/i;

function eventoValido(valor: unknown): valor is EventoDesempenhoEntrada {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const evento = valor as Record<string, unknown>;
  const resumo = evento.resumoIpc;
  return ['renderer', 'main', 'ipc', 'placeholder', 'ilustracao', 'processo'].includes(String(evento.origem))
    && typeof evento.categoria === 'string' && PADRAO_IDENTIFICADOR.test(evento.categoria)
    && typeof evento.evento === 'string' && PADRAO_IDENTIFICADOR.test(evento.evento)
    && (evento.operacao === undefined || (typeof evento.operacao === 'string' && PADRAO_IDENTIFICADOR.test(evento.operacao)))
    && (evento.canal === undefined || (typeof evento.canal === 'string' && PADRAO_IDENTIFICADOR.test(evento.canal)))
    && (evento.duracaoMs === undefined || (typeof evento.duracaoMs === 'number' && Number.isFinite(evento.duracaoMs)))
    && (resumo === undefined || (Array.isArray(resumo) && resumo.length <= 10 && resumo.every(item => item && typeof item === 'object')));
}

function publicarEstado(estado: EstadoCapturaDesempenho): void {
  BrowserWindow.getAllWindows().filter(janela => !janela.isDestroyed()).forEach(janela => janela.webContents.send('desempenho:perfil-alterado', estado));
}

export function registerDesempenhoHandlers(): void {
  ipcMain.handle('desempenho:estado', async () => ({ success: true, data: await desempenhoService.obterEstado() }));
  ipcMain.handle('desempenho:configurar-perfil', async (_evento, perfil: unknown) => {
    if (perfil !== 'importante' && perfil !== 'critico') return { success: false, error: 'Perfil inválido.' };
    const estado = await desempenhoService.configurarPerfil(perfil);
    publicarEstado(estado);
    return { success: true, data: estado };
  });
  ipcMain.handle('desempenho:iniciar-detalhada', async () => {
    const estado = await desempenhoService.iniciarDetalhada();
    publicarEstado(estado);
    return { success: true, data: estado };
  });
  ipcMain.handle('desempenho:parar-detalhada', async () => {
    const estado = await desempenhoService.pararDetalhada();
    publicarEstado(estado);
    return { success: true, data: estado };
  });
  ipcMain.handle('desempenho:marcar-problema', async () => { await desempenhoService.marcarProblema(); return { success: true }; });
  ipcMain.handle('desempenho:listar', async () => ({ success: true, data: await desempenhoService.listar() }));
  ipcMain.handle('desempenho:exportar-csv', async event => {
    const janela = BrowserWindow.fromWebContents(event.sender);
    const resultado = janela ? await dialog.showSaveDialog(janela, { title: 'Exportar diagnóstico de desempenho', defaultPath: `diagnostico-desempenho-${new Date().toISOString().slice(0, 10)}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] }) : await dialog.showSaveDialog({ title: 'Exportar diagnóstico de desempenho', defaultPath: `diagnostico-desempenho-${new Date().toISOString().slice(0, 10)}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (resultado.canceled || !resultado.filePath) return { success: true, canceled: true };
    await fs.writeFile(resultado.filePath, await desempenhoService.exportarCsv(), 'utf8');
    return { success: true };
  });
  ipcMain.on('desempenho:registrar', (_evento, entrada: unknown) => { if (eventoValido(entrada)) void desempenhoService.registrar(entrada); });
  ipcMain.on('desempenho:registrar-lote', (_evento, entradas: unknown) => {
    if (!Array.isArray(entradas) || entradas.length > 100) return;
    entradas.filter(eventoValido).forEach(entrada => void desempenhoService.registrar(entrada));
  });
}
