import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ipcOn: vi.fn(),
  ipcHandle: vi.fn(),
  criarBrowserWindow: vi.fn(),
  fromWebContents: vi.fn(),
  fromId: vi.fn(),
  configuracaoObter: vi.fn(),
  configuracaoSalvar: vi.fn(),
}))

vi.mock('electron', () => {
  class BrowserWindow {
    static fromWebContents = mocks.fromWebContents
    static fromId = mocks.fromId

    constructor(opcoes: unknown) {
      return mocks.criarBrowserWindow(opcoes)
    }
  }

  return {
    ipcMain: { on: mocks.ipcOn, handle: mocks.ipcHandle },
    BrowserWindow,
    screen: {
      getDisplayMatching: vi.fn(() => ({ workAreaSize: { width: 1000, height: 800 } })),
      getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 1000, height: 800 } })),
    },
  }
})

vi.mock('../../main/services/configuracao.service.js', () => ({
  configuracaoService: { obter: mocks.configuracaoObter, salvar: mocks.configuracaoSalvar },
}))

vi.mock('../../main/services/imagem-laudo.service.js', () => ({
  atualizarLegendaImagemLaudo: vi.fn(),
  atualizarOrdemImagensLaudo: vi.fn(),
  arquivarImagemLaudo: vi.fn(),
  disponibilizarImagemLaudo: vi.fn(),
  excluirImagemLaudo: vi.fn(),
  listarImagensLaudo: vi.fn(),
  listarResumosImagensLaudo: vi.fn(),
  obterImagemLaudoPorId: vi.fn(),
  obterMiniaturasImagensLaudo: vi.fn(),
  reconciliarImagensLaudo: vi.fn(),
  salvarImagemLaudo: vi.fn(),
}))

vi.mock('../../main/services/laudo.service.js', () => ({ laudoService: { findById: vi.fn() } }))

vi.mock('../../main/utils/logger.js', () => ({ logDebug: vi.fn(), logError: vi.fn() }))

import { registerIlustracoesHandlers } from '../../main/ipc/handlers/ilustracoes.handlers'

describe('janela destacada do painel de Ilustrações', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configuracaoObter.mockResolvedValue(JSON.stringify({
      versao: 1,
      largura: 700,
      altura: 1000,
    }))
    mocks.configuracaoSalvar.mockResolvedValue(undefined)
  })

  it('carrega e limita as dimensões persistidas antes de criar a janela', async () => {
    const janelaPrincipal = {
      id: 10,
      isDestroyed: vi.fn(() => false),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1000, height: 800 })),
    }
    const janelaPainel = {
      webContents: { id: 20, send: vi.fn() },
      loadURL: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      isDestroyed: vi.fn(() => false),
      getSize: vi.fn(() => [700, 720]),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 700, height: 720 })),
      once: vi.fn(),
      on: vi.fn(),
    }
    mocks.fromWebContents.mockReturnValue(janelaPrincipal)
    mocks.criarBrowserWindow.mockReturnValue(janelaPainel)

    registerIlustracoesHandlers({
      preloadPath: 'preload.js',
      rendererHtmlPath: 'index.html',
      isDev: false,
    })
    const on = new Map(mocks.ipcOn.mock.calls.map(([canal, callback]) => [canal, callback]))

    await on.get('ilustracoes:open-panel')?.(
      { sender: { id: 101 } },
      'laudo-1',
      'REP 1/2026',
    )

    expect(mocks.configuracaoObter).toHaveBeenCalledWith('janela_painel_ilustracoes_dimensoes')
    expect(mocks.criarBrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      width: 700,
      height: 720,
      minWidth: 320,
      minHeight: 400,
    }))
  })
})
