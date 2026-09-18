import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { atualizacaoService, normalizarFalhaAtualizacao } from '../../services/atualizacao.service.js';
import type { AcaoAtualizacao, AutorizacaoReinicioAtualizacao, EtapaFalhaAtualizacao } from '../../../shared/atualizacao/atualizacao.types.js';

function respostaErro(erro: unknown, etapa: EtapaFalhaAtualizacao = 'operacao', acaoSugerida?: AcaoAtualizacao) {
  return { success: false, data: atualizacaoService.obterEstado(), falha: normalizarFalhaAtualizacao(erro, etapa, acaoSugerida) };
}

const autorizacoesPendentes = new Map<string, { webContentsId: number; resolver: (resposta: AutorizacaoReinicioAtualizacao) => void }>();

function solicitarAutorizacaoReinicio(webContents: WebContents): Promise<void> {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => {
      autorizacoesPendentes.delete(id);
      reject(new Error('A confirmação de fechamento seguro expirou.'));
    }, 15_000);
    autorizacoesPendentes.set(id, {
      webContentsId: webContents.id,
      resolver: resposta => {
        clearTimeout(temporizador);
        autorizacoesPendentes.delete(id);
        if (resposta.autorizado) resolve();
        else reject(new Error(resposta.impedimentos.join(' ') || 'Existem alterações não salvas. Salve ou descarte-as antes de atualizar.'));
      },
    });
    webContents.send('atualizacao:solicitar-reinicio', id);
  });
}

export function registerAtualizacaoHandlers(): void {
  atualizacaoService.onProgresso(progresso => {
    for (const janela of BrowserWindow.getAllWindows()) {
      if (!janela.isDestroyed()) janela.webContents.send('atualizacao:progresso', progresso);
    }
  });
  ipcMain.handle('atualizacao:estado', () => ({ success: true, data: atualizacaoService.obterEstado() }));
  ipcMain.handle('atualizacao:verificar', async () => {
    try { const data = await atualizacaoService.verificar(true); return data.falha ? { success: false, data, falha: data.falha } : { success: true, data }; } catch (erro) { return respostaErro(erro, 'verificacao', 'verificar'); }
  });
  ipcMain.handle('atualizacao:baixar', async () => {
    try { const data = await atualizacaoService.baixar(); return data.falha ? { success: false, data, falha: data.falha } : { success: true, data }; } catch (erro) { return respostaErro(erro, 'download', 'baixar'); }
  });
  ipcMain.handle('atualizacao:adiar', () => {
    try { return { success: true, data: atualizacaoService.adiar() }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:instalar-agora', async evento => {
    try {
      const data = await atualizacaoService.instalarAgora(() => solicitarAutorizacaoReinicio(evento.sender));
      return data.falha ? { success: false, data, falha: data.falha } : { success: true, data };
    } catch (erro) { return respostaErro(erro, 'instalacao', 'instalar'); }
  });
  ipcMain.handle('atualizacao:agendar', () => {
    try { return { success: true, data: atualizacaoService.agendarParaProximaInicializacao() }; } catch (erro) { return respostaErro(erro); }
  });
  ipcMain.handle('atualizacao:mostrar-pacote', () => {
    try { return { success: atualizacaoService.mostrarPacoteBaixado() }; } catch (erro) { return respostaErro(erro, 'instalacao', 'instalar'); }
  });
  ipcMain.handle('atualizacao:responder-reinicio', (evento, id: unknown, resposta: unknown) => {
    if (typeof id !== 'string' || typeof resposta !== 'object' || resposta === null || Array.isArray(resposta)) return { success: false };
    const valor = resposta as Record<string, unknown>;
    if (typeof valor.autorizado !== 'boolean' || !Array.isArray(valor.impedimentos) || valor.impedimentos.some(item => typeof item !== 'string')) return { success: false };
    const pendencia = autorizacoesPendentes.get(id);
    if (!pendencia || pendencia.webContentsId !== evento.sender.id) return { success: false };
    pendencia.resolver({ autorizado: valor.autorizado, impedimentos: valor.impedimentos });
    return { success: true };
  });
}
