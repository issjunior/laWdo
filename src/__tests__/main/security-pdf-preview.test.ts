import { beforeEach, describe, expect, it, vi } from 'vitest'

type Cabecalhos = Record<string, string[]>
type DetalhesResposta = {
  resourceType: string
  responseHeaders?: Cabecalhos
  url: string
}
type RespostaCabecalhos = { responseHeaders?: Cabecalhos }
type ListenerCabecalhos = (
  detalhes: DetalhesResposta,
  callback: (resposta: RespostaCabecalhos) => void,
) => void

const mocks = vi.hoisted(() => ({
  appendSwitch: vi.fn(),
  onHeadersReceived: vi.fn(),
  setPermissionRequestHandler: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    commandLine: {
      appendSwitch: mocks.appendSwitch,
    },
  },
  session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: mocks.onHeadersReceived,
      },
      setPermissionRequestHandler: mocks.setPermissionRequestHandler,
    },
  },
}))

vi.mock('../../main/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

import { setupSecurity } from '../../main/security/index'

function executarListener(detalhes: DetalhesResposta): RespostaCabecalhos {
  const listener = mocks.onHeadersReceived.mock.calls[0]?.[0] as ListenerCabecalhos
  let resposta: RespostaCabecalhos | undefined

  listener(detalhes, resultado => {
    resposta = resultado
  })

  return resposta ?? {}
}

describe('configuração de segurança para preview PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSecurity()
  })

  it('registra um único listener de headers para evitar que a CSP seja substituída', () => {
    expect(mocks.onHeadersReceived).toHaveBeenCalledTimes(1)
  })

  it('não altera a resposta do visualizador PDF interno em um subframe', () => {
    const resposta = executarListener({
      resourceType: 'subFrame',
      responseHeaders: { 'Content-Type': ['text/html'] },
      url: 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html',
    })

    expect(resposta).toEqual({})
  })

  it('não altera o PDF blob carregado no iframe', () => {
    const resposta = executarListener({
      resourceType: 'subFrame',
      responseHeaders: { 'Content-Type': ['application/pdf'] },
      url: 'blob:file:///preview-pdf',
    })

    expect(resposta).toEqual({})
  })

  it('aplica CSP e headers somente ao documento principal do laWdo', () => {
    const resposta = executarListener({
      resourceType: 'mainFrame',
      responseHeaders: { 'Content-Type': ['text/html'] },
      url: 'file:///renderer/index.html',
    })

    expect(resposta.responseHeaders).toMatchObject({
      'Content-Security-Policy': [expect.stringContaining('frame-src')],
      'X-Content-Type-Options': ['nosniff'],
      'X-Frame-Options': ['DENY'],
    })
    expect(resposta.responseHeaders?.['Content-Security-Policy']?.[0]).toContain(
      'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai',
    )
  })
})
