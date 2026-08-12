import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ipcOn: vi.fn(),
  ipcHandle: vi.fn(),
  criarBrowserWindow: vi.fn(),
  fromWebContents: vi.fn(),
  fromId: vi.fn(),
  clipboardWriteText: vi.fn(),
  executar: vi.fn(),
  planejar: vi.fn(),
  descartarRetomada: vi.fn(),
  descreverImagem: vi.fn(),
  cancelar: vi.fn(),
  obterContexto: vi.fn(),
  obterPerfil: vi.fn(),
  salvarPerfil: vi.fn(),
  configuracaoObter: vi.fn(),
  configuracaoSalvar: vi.fn(),
}));

vi.mock('electron', () => {
  class BrowserWindow {
    static fromWebContents = mocks.fromWebContents;
    static fromId = mocks.fromId;

    constructor(opcoes: unknown) {
      return mocks.criarBrowserWindow(opcoes);
    }
  }

  return {
    ipcMain: { on: mocks.ipcOn, handle: mocks.ipcHandle },
    clipboard: { writeText: mocks.clipboardWriteText },
    BrowserWindow,
    screen: {
      getDisplayMatching: vi.fn(() => ({ workAreaSize: { width: 1600, height: 900 } })),
      getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 1600, height: 900 } })),
    },
  };
});

vi.mock('../../main/services/configuracao.service.js', () => ({
  configuracaoService: { obter: mocks.configuracaoObter, salvar: mocks.configuracaoSalvar },
}));

vi.mock('../../main/services/ia-execucao.service.js', () => ({
  ErroExecucaoIa: class ErroExecucaoIa extends Error {},
  iaExecucaoService: {
    executar: mocks.executar,
    planejar: mocks.planejar,
    descartarRetomada: mocks.descartarRetomada,
    descreverImagem: mocks.descreverImagem,
    cancelar: mocks.cancelar,
    obterContexto: mocks.obterContexto,
    obterPerfil: mocks.obterPerfil,
    salvarPerfil: mocks.salvarPerfil,
  },
}));

vi.mock('../../main/utils/logger.js', () => ({
  logDebug: vi.fn(),
  logError: vi.fn(),
}));

import { registerIAHandlers } from '../../main/ipc/handlers/ia.handlers';

describe('handlers IPC do painel de IA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configuracaoObter.mockResolvedValue(null);
    mocks.configuracaoSalvar.mockResolvedValue(undefined);
  });

  it('autoriza a sessão, valida snapshots e restringe operações ao renderer proprietário', async () => {
    const eventosJanela = new Map<string, () => void>();
    const eventosProprietario = new Map<string, () => void>();
    const webContentsProprietario = {
      id: 101,
      send: vi.fn(),
      once: vi.fn((canal: string, callback: () => void) => eventosProprietario.set(canal, callback)),
    };
    const proprietario = {
      id: 10,
      webContents: webContentsProprietario,
      isDestroyed: vi.fn(() => false),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
      once: vi.fn(),
    };
    const webContentsPainel = { id: 202, send: vi.fn() };
    const janelaPainel = {
      webContents: webContentsPainel,
      loadURL: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      isDestroyed: vi.fn(() => false),
      getSize: vi.fn(() => [460, 720]),
      once: vi.fn((canal: string, callback: () => void) => eventosJanela.set(canal, callback)),
      on: vi.fn((canal: string, callback: () => void) => eventosJanela.set(canal, callback)),
    };
    mocks.criarBrowserWindow.mockReturnValue(janelaPainel);
    mocks.fromWebContents.mockImplementation(remetente => remetente === webContentsProprietario ? proprietario : null);
    mocks.fromId.mockImplementation(id => id === proprietario.id ? proprietario : null);

    registerIAHandlers({ preloadPath: 'preload.js', rendererHtmlPath: 'index.html', isDev: false });
    const on = new Map(mocks.ipcOn.mock.calls.map(([canal, callback]) => [canal, callback]));
    const handle = new Map(mocks.ipcHandle.mock.calls.map(([canal, callback]) => [canal, callback]));

    await on.get('ia:painel-abrir')?.({ sender: webContentsProprietario }, 'sessao-1');
    expect(mocks.criarBrowserWindow).toHaveBeenCalledTimes(1);
    expect(mocks.criarBrowserWindow).toHaveBeenCalledWith(expect.objectContaining({ width: 460, height: 720 }));
    expect(janelaPainel.loadURL).toHaveBeenCalledWith('file://index.html#/painel-ia?sessionId=sessao-1');

    const estado = {
      revisao: 1,
      titulo: 'Documento completo',
      carregando: false,
      erro: null,
      editorDisponivel: true,
      imagemSelecionada: false,
      contextoImagem: false,
      modoAplicacao: 'substituir',
      progresso: null,
      planoPendente: null,
      retomada: null,
      mensagens: [],
      escopos: [{ id: -1, titulo: 'Documento completo' }],
    };
    on.get('ia:painel-publicar')?.({ sender: webContentsProprietario }, 'sessao-1', {
      tipo: 'snapshot',
      estado: { ...estado, revisao: 0 },
    });
    expect(webContentsPainel.send).not.toHaveBeenCalled();
    const snapshot = { tipo: 'snapshot', estado };
    on.get('ia:painel-publicar')?.({ sender: webContentsProprietario }, 'sessao-1', snapshot);
    expect(webContentsPainel.send).toHaveBeenCalledWith('ia:painel-estado', snapshot);
    const delta = { tipo: 'delta', revisao: 2, alteracoes: { carregando: true } };
    on.get('ia:painel-publicar')?.({ sender: webContentsProprietario }, 'sessao-1', delta);
    expect(webContentsPainel.send).toHaveBeenCalledWith('ia:painel-estado', delta);

    on.get('ia:painel-pronto')?.({ sender: webContentsPainel });
    expect(webContentsProprietario.send).toHaveBeenCalledWith('ia:painel-pronto', 'sessao-1');
    on.get('ia:painel-comando')?.({ sender: webContentsPainel }, { tipo: 'aplicar_resposta', indiceMensagem: 0 });
    expect(webContentsProprietario.send).not.toHaveBeenCalledWith('ia:painel-comando', expect.anything());
    const comando = { tipo: 'aplicar_resposta', mensagemId: 'mensagem-1' };
    on.get('ia:painel-comando')?.({ sender: webContentsPainel }, comando);
    expect(webContentsProprietario.send).toHaveBeenCalledWith('ia:painel-comando', comando);

    let concluirExecucao: ((valor: unknown) => void) | undefined;
    mocks.executar.mockReturnValue(new Promise(resolve => { concluirExecucao = resolve; }));
    const solicitacao = {
      operationId: 'operacao-1',
      acao: 'clareza',
      escopo: 'secao',
      fragmentos: [{ id: 'fragmento-1', texto: 'Texto original.' }],
    };
    mocks.planejar.mockResolvedValue({
      planoId: 'plano-1',
      acao: 'clareza',
      escopo: 'secao',
      provedor: 'gemini',
      modelo: 'gemini-2.5-flash',
      totalLotes: 1,
      chamadasBase: 1,
      limiteMaximoChamadas: 8,
      requerConfirmacao: false,
    });
    await expect(handle.get('ia:planejar')?.({ sender: webContentsProprietario }, solicitacao))
      .resolves.toEqual({
        success: true,
        data: expect.objectContaining({ planoId: 'plano-1', totalLotes: 1 }),
      });
    const eventoProprietario = { sender: webContentsProprietario };
    const execucao = handle.get('ia:executar')?.(eventoProprietario, solicitacao);
    await Promise.resolve();
    await expect(handle.get('ia:executar')?.(eventoProprietario, { ...solicitacao, operationId: 'operacao-2' }))
      .resolves.toEqual({ success: false, error: 'OPERACAO_EM_ANDAMENTO' });

    await expect(handle.get('ia:cancelar')?.({ sender: { id: 999 } }, 'operacao-1'))
      .resolves.toEqual({ success: true });
    expect(mocks.cancelar).not.toHaveBeenCalled();
    await handle.get('ia:cancelar')?.(eventoProprietario, 'operacao-1');
    expect(mocks.cancelar).toHaveBeenCalledWith('operacao-1');

    concluirExecucao?.({ operationId: 'operacao-1', fragmentos: solicitacao.fragmentos });
    await expect(execucao).resolves.toEqual({
      success: true,
      data: { operationId: 'operacao-1', fragmentos: solicitacao.fragmentos },
    });

    expect(handle.get('ia:copiar-resposta')?.(eventoProprietario, 'Resposta conferida.'))
      .toEqual({ success: true });
    expect(mocks.clipboardWriteText).toHaveBeenCalledWith('Resposta conferida.');
    expect(handle.get('ia:copiar-resposta')?.(eventoProprietario, ''))
      .toEqual({ success: false, error: 'Texto inválido para cópia.' });

    await expect(handle.get('ia:planejar')?.(eventoProprietario, { operationId: '' }))
      .resolves.toEqual({ success: false, error: 'ENTRADA_INVALIDA' });
    await expect(handle.get('ia:descrever-imagem')?.(eventoProprietario, { operationId: '' }))
      .resolves.toEqual({ success: false, error: 'ENTRADA_INVALIDA' });
    await expect(handle.get('ia:cancelar')?.(eventoProprietario, ''))
      .resolves.toEqual({ success: false, error: 'ENTRADA_INVALIDA' });
    await expect(handle.get('ia:descartar-retomada')?.(eventoProprietario, 'retomada-ausente'))
      .resolves.toEqual({ success: false, error: 'RETOMADA_INDISPONIVEL' });

    mocks.obterContexto.mockResolvedValueOnce({ configurado: false });
    await expect(handle.get('ia:testar-conexao')?.(eventoProprietario))
      .resolves.toEqual({ success: false, error: 'CONFIGURACAO_AUSENTE' });
    mocks.obterContexto.mockResolvedValueOnce({ configurado: true, provedor: 'gemini' });
    await expect(handle.get('ia:testar-conexao')?.(eventoProprietario))
      .resolves.toEqual({ success: true, data: { configurado: true, provedor: 'gemini' } });
    mocks.obterContexto.mockRejectedValueOnce(new Error('Configuração indisponível'));
    await expect(handle.get('ia:obter-contexto')?.(eventoProprietario))
      .resolves.toEqual({ success: false, error: 'Configuração indisponível' });

    mocks.obterPerfil.mockResolvedValueOnce({ versao: 1, tom: 'formal' });
    await expect(handle.get('ia:obter-perfil')?.(eventoProprietario))
      .resolves.toEqual({ success: true, data: { versao: 1, tom: 'formal' } });
    await expect(handle.get('ia:salvar-perfil')?.(eventoProprietario, { tom: 'inválido' }))
      .resolves.toEqual({ success: false, error: 'ENTRADA_INVALIDA' });
    const perfil = { versao: 1, tom: 'formal', detalhamento: 'equilibrado', instrucoesPersonalizadas: '', temperatura: 0.2 };
    await expect(handle.get('ia:salvar-perfil')?.(eventoProprietario, perfil))
      .resolves.toEqual({ success: true });
    expect(mocks.salvarPerfil).toHaveBeenCalledWith(perfil);

    const descricao = { operationId: 'descricao-1', laudoId: 'laudo-1', imagemId: 'imagem-1' };
    mocks.descreverImagem.mockResolvedValueOnce({ operationId: 'descricao-1', descricao: 'Objeto metálico.' });
    await expect(handle.get('ia:descrever-imagem')?.(eventoProprietario, descricao))
      .resolves.toEqual({ success: true, data: { operationId: 'descricao-1', descricao: 'Objeto metálico.' } });

    await expect(handle.get('ia:revisarOrtografia')?.(eventoProprietario, ''))
      .resolves.toEqual({ success: false, error: 'Texto inválido' });
    await expect(handle.get('ia:adequarEscrita')?.(eventoProprietario, ''))
      .resolves.toEqual({ success: false, error: 'Texto inválido' });
    await expect(handle.get('ia:perguntar')?.(eventoProprietario, ''))
      .resolves.toEqual({ success: false, error: 'Pergunta inválida' });
  });
});
