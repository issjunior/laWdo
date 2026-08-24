import { ipcMain, BrowserWindow } from 'electron';
import { logDebug, logError } from '../../utils/logger.js';
import {
  atualizarLegendaImagemLaudo,
  atualizarOrdemImagensLaudo,
  arquivarImagemLaudo,
  disponibilizarImagemLaudo,
  excluirImagemLaudo,
  listarResumosImagensLaudo,
  obterImagemLaudoPorId,
  obterMiniaturasImagensLaudo,
  reconciliarImagensLaudo,
  salvarImagemLaudo,
} from '../../services/imagem-laudo.service.js';
import { laudoService } from '../../services/laudo.service.js';
import type { SalvarImagemLaudoEntrada } from '../../../shared/types/imagem-laudo.types.js';
import { carregarDimensoesJanela, observarDimensoesJanela } from '../../utils/dimensoes-janela.js';

interface IlustracoesHandlerOptions {
  preloadPath: string;
  rendererHtmlPath: string;
  isDev: boolean;
}

let panelWindow: BrowserWindow | null = null;
let mainWindowId: number | null = null;
let criandoPanelWindow = false;

export function registerIlustracoesHandlers(options: IlustracoesHandlerOptions): void {
  const { preloadPath, rendererHtmlPath, isDev } = options;

  ipcMain.handle('ilustracoes:reconciliar-imagens', async (_event, laudoId: unknown) => {
    try {
      if (typeof laudoId !== 'string') throw new Error('Laudo inválido.')
      const laudo = await laudoService.findById(laudoId)
      if (!laudo) throw new Error('Laudo não encontrado.')
      return { success: true, data: await reconciliarImagensLaudo(laudoId, laudo.conteudo) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao reconciliar as imagens do laudo.' }
    }
  })

  ipcMain.handle('ilustracoes:listar-imagens', async (_event, laudoId: unknown) => {
    try {
      if (typeof laudoId !== 'string') throw new Error('Laudo inválido.')
      return { success: true, data: await listarResumosImagensLaudo(laudoId) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao listar imagens do laudo.' }
    }
  })

  ipcMain.handle('ilustracoes:obter-imagem', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      return { success: true, data: await obterImagemLaudoPorId(laudoId, imagemId) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar a imagem do laudo.' }
    }
  })

  ipcMain.handle('ilustracoes:obter-miniaturas', async (_event, laudoId: unknown, ids: unknown) => {
    try {
      if (typeof laudoId !== 'string' || !Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Imagens inválidas.')
      return { success: true, data: await obterMiniaturasImagensLaudo(laudoId, ids) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar as miniaturas.' }
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

  ipcMain.on('ilustracoes:open-panel', async (event, laudoId: unknown, tituloLaudo: unknown) => {
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
    if (criandoPanelWindow) return;

    criandoPanelWindow = true;
    try {
      const dimensoes = await carregarDimensoesJanela({
        chave: 'janela_painel_ilustracoes_dimensoes',
        descricao: 'Dimensões da janela destacada do painel de Ilustrações',
        larguraPadrao: 420,
        alturaPadrao: 700,
        larguraMinima: 320,
        alturaMinima: 400,
        janelaReferencia: senderWin,
      });
      panelWindow = new BrowserWindow({
        width: dimensoes.largura,
        height: dimensoes.altura,
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
      observarDimensoesJanela(panelWindow, {
        chave: 'janela_painel_ilustracoes_dimensoes',
        descricao: 'Dimensões da janela destacada do painel de Ilustrações',
        larguraMinima: 320,
        alturaMinima: 400,
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
    } finally {
      criandoPanelWindow = false;
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
