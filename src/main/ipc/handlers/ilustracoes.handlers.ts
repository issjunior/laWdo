import { ipcMain, BrowserWindow } from 'electron';
import { logDebug, logError } from '../../utils/logger.js';
import {
  atualizarLegendaImagemLaudo,
  atualizarOrdemImagensLaudo,
  arquivarImagemLaudo,
  disponibilizarImagemLaudo,
  descartarImagemEstagiadaLaudo,
  descartarImagensEstagiadasLaudo,
  estagiarImagemLaudoPorDataUri,
  excluirImagemLaudo,
  listarResumosImagensLaudo,
  listarImagensEstagiadasLaudo,
  limparImagensTemporariasSemReferencia,
  obterImagemLaudoPorId,
  obterImagemEstagiadaLaudo,
  obterImagemImpressaoLaudo,
  obterMiniaturasImagensLaudo,
  prepararImagemEditorLaudo,
  reconciliarImagensLaudo,
  salvarImagemLaudo,
} from '../../services/imagem-laudo.service.js';
import { laudoService } from '../../services/laudo.service.js';
import type { SalvarImagemLaudoEntrada } from '../../../shared/types/imagem-laudo.types.js';
import { carregarDimensoesJanela, observarDimensoesJanela } from '../../utils/dimensoes-janela.js';
import { desempenhoService } from '../../services/desempenho.service.js';
import { comContextoImagens, cancelarProcessamentoImagens } from '../../services/processador-imagens.service.js';

const contextosRemetentes = new Map<number, Set<string>>();
function registrar(canal: string, executar: Parameters<typeof ipcMain.handle>[1]): void {
  ipcMain.handle(canal, (evento, ...parametros: unknown[]) => {
    const laudo = typeof parametros[0] === 'string' ? parametros[0] : '';
    const remetente = evento.sender;
    const chave = `${remetente?.id ?? 'teste'}:${laudo}`;
    if (remetente && !contextosRemetentes.has(remetente.id)) {
      contextosRemetentes.set(remetente.id, new Set());
      remetente.once('destroyed', () => {
        for (const contexto of contextosRemetentes.get(remetente.id) ?? []) cancelarProcessamentoImagens(contexto);
        contextosRemetentes.delete(remetente.id);
      });
    }
    if (remetente) contextosRemetentes.get(remetente.id)?.add(chave);
    if (canal === 'ilustracoes:encerrar-sessao') cancelarProcessamentoImagens(chave);
    return comContextoImagens(chave, () => executar(evento, ...parametros));
  });
}

interface IlustracoesHandlerOptions {
  preloadPath: string;
  rendererHtmlPath: string;
  isDev: boolean;
}

let panelWindow: BrowserWindow | null = null;
let mainWindowId: number | null = null;
let criandoPanelWindow = false;

async function executarMedido<T>(operacao: string, acao: () => Promise<T>, metadados: Record<string, number | boolean> = {}): Promise<T> {
  const inicio = performance.now();
  try {
    return await acao();
  } finally {
    void desempenhoService.registrar({ origem: 'ilustracao', categoria: 'servico', evento: 'concluido', operacao, duracaoMs: performance.now() - inicio, metadados });
  }
}

export function registerIlustracoesHandlers(options: IlustracoesHandlerOptions): void {
  const { preloadPath, rendererHtmlPath, isDev } = options;

  registrar('ilustracoes:reconciliar-imagens', async (_event, laudoId: unknown) => {
    try {
      if (typeof laudoId !== 'string') throw new Error('Laudo inválido.')
      const laudo = await laudoService.findById(laudoId)
      if (!laudo) throw new Error('Laudo não encontrado.')
      return { success: true, data: await executarMedido('reconciliar_imagens', () => reconciliarImagensLaudo(laudoId, laudo.conteudo)) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao reconciliar as imagens do laudo.' }
    }
  })

  registrar('ilustracoes:listar-imagens', async (_event, laudoId: unknown) => {
    try {
      if (typeof laudoId !== 'string') throw new Error('Laudo inválido.')
      return { success: true, data: await executarMedido('listar_imagens', () => listarResumosImagensLaudo(laudoId)) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao listar imagens do laudo.' }
    }
  })

  registrar('ilustracoes:obter-imagem', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      return { success: true, data: await executarMedido('obter_imagem', () => obterImagemLaudoPorId(laudoId, imagemId), { imagens: 1 }) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar a imagem do laudo.' }
    }
  })

  registrar('ilustracoes:obter-imagem-estagio', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      return { success: true, data: obterImagemEstagiadaLaudo(laudoId, imagemId) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar imagem temporária.' }
    }
  })

  registrar('ilustracoes:obter-imagem-impressao', async (_event, laudoId: unknown, imagemId: unknown, larguraMaxima: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string' || typeof larguraMaxima !== 'number'
        || !Number.isInteger(larguraMaxima) || larguraMaxima < 1 || larguraMaxima > 3000) throw new Error('Imagem para impressão inválida.')
      return { success: true, data: await executarMedido('obter_imagem_impressao',
        () => obterImagemImpressaoLaudo(laudoId, imagemId, larguraMaxima), { imagens: 1 }) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao preparar a imagem para impressão.' }
    }
  })

  registrar('ilustracoes:obter-miniaturas', async (_event, laudoId: unknown, ids: unknown) => {
    try {
      if (typeof laudoId !== 'string' || !Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Imagens inválidas.')
      return { success: true, data: await executarMedido('obter_miniaturas', () => obterMiniaturasImagensLaudo(laudoId, ids), { imagens: ids.length }) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar as miniaturas.' }
    }
  })

  registrar('ilustracoes:salvar-imagem', async (_event, laudoId: unknown, entrada: unknown) => {
    try {
      if (typeof laudoId !== 'string' || !entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('Imagem inválida.')
      const dados = entrada as Partial<SalvarImagemLaudoEntrada>
      if (typeof dados.id !== 'string' || typeof dados.nomeArquivo !== 'string' || typeof dados.dataUri !== 'string'
        || typeof dados.legenda !== 'string' || (dados.origem !== 'local' && dados.origem !== 'gdl') || typeof dados.sequencia !== 'number') {
        throw new Error('Dados da imagem inválidos.')
      }
      if (dados.imagemOrigemId !== undefined && typeof dados.imagemOrigemId !== 'string') throw new Error('Origem da imagem inválida.')
      if (dados.ajustesJson !== undefined && typeof dados.ajustesJson !== 'string') throw new Error('Ajustes da imagem inválidos.')
      return { success: true, data: await executarMedido('salvar_imagem', () => salvarImagemLaudo(laudoId, dados as SalvarImagemLaudoEntrada), { imagens: 1, bytesEntrada: dados.dataUri.length }) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao salvar imagem do laudo.' }
    }
  })

  registrar('ilustracoes:estagiar-imagem', async (_event, laudoId: unknown, entrada: unknown) => {
    try {
      if (typeof laudoId !== 'string' || !entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('Imagem inválida.')
      const dados = entrada as Partial<SalvarImagemLaudoEntrada>
      if (typeof dados.id !== 'string' || typeof dados.nomeArquivo !== 'string' || typeof dados.dataUri !== 'string'
        || typeof dados.legenda !== 'string' || (dados.origem !== 'local' && dados.origem !== 'gdl') || typeof dados.sequencia !== 'number') {
        throw new Error('Dados da imagem inválidos.')
      }
      return { success: true, data: await estagiarImagemLaudoPorDataUri(laudoId, dados as SalvarImagemLaudoEntrada) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao preparar imagem temporária.' }
    }
  })

  registrar('ilustracoes:listar-estagio', async (_event, laudoId: unknown) => {
    try {
      if (typeof laudoId !== 'string') throw new Error('Laudo inválido.')
      return { success: true, data: listarImagensEstagiadasLaudo(laudoId) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao listar imagens temporárias.' }
    }
  })

  registrar('ilustracoes:preparar-insercao', async (_event, laudoId: unknown, imagemId: unknown,
    larguraCss: unknown, alturaCss: unknown, densidade: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string'
        || typeof larguraCss !== 'number' || typeof alturaCss !== 'number' || typeof densidade !== 'number') throw new Error('Imagem inválida.')
      return { success: true, data: await executarMedido('preparar_insercao',
        () => prepararImagemEditorLaudo(laudoId, imagemId, larguraCss, alturaCss, densidade), { imagens: 1 }) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao preparar prévia da imagem.' }
    }
  })

  registrar('ilustracoes:descartar-estagio', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string') throw new Error('Laudo inválido.')
      if (typeof imagemId === 'string') descartarImagemEstagiadaLaudo(laudoId, imagemId)
      else descartarImagensEstagiadasLaudo(laudoId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao descartar imagem temporária.' }
    }
  })

  registrar('ilustracoes:encerrar-sessao', async (_event, laudoId: unknown) => {
    try {
      if (typeof laudoId !== 'string') throw new Error('Laudo inválido.')
      descartarImagensEstagiadasLaudo(laudoId)
      await limparImagensTemporariasSemReferencia(laudoId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao encerrar sessão de imagens.' }
    }
  })

  registrar('ilustracoes:excluir-imagem', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      await executarMedido('excluir_imagem', () => excluirImagemLaudo(laudoId, imagemId), { imagens: 1 })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao excluir imagem do laudo.' }
    }
  })

  registrar('ilustracoes:arquivar-imagem', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      await arquivarImagemLaudo(laudoId, imagemId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao arquivar imagem do laudo.' }
    }
  })

  registrar('ilustracoes:disponibilizar-imagem', async (_event, laudoId: unknown, imagemId: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string') throw new Error('Imagem inválida.')
      await disponibilizarImagemLaudo(laudoId, imagemId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao disponibilizar imagem do laudo.' }
    }
  })

  registrar('ilustracoes:atualizar-legenda', async (_event, laudoId: unknown, imagemId: unknown, legenda: unknown) => {
    try {
      if (typeof laudoId !== 'string' || typeof imagemId !== 'string' || typeof legenda !== 'string') throw new Error('Legenda inválida.')
      await atualizarLegendaImagemLaudo(laudoId, imagemId, legenda)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar legenda.' }
    }
  })

  registrar('ilustracoes:atualizar-ordem', async (_event, laudoId: unknown, ordem: unknown) => {
    try {
      if (typeof laudoId !== 'string' || !Array.isArray(ordem) || ordem.some(item => (
        !item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.sequencia !== 'number'
      ))) throw new Error('Ordem das imagens inválida.')
      await executarMedido('atualizar_ordem', () => atualizarOrdemImagensLaudo(laudoId, ordem), { imagens: ordem.length })
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
