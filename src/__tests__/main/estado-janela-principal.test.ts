import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  monitores: [] as Array<{
    id: number
    scaleFactor: number
    workArea: { x: number; y: number; width: number; height: number }
  }>,
  obter: vi.fn(),
  salvar: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('electron', () => ({
  screen: {
    getAllDisplays: vi.fn(() => mocks.monitores),
    getPrimaryDisplay: vi.fn(() => mocks.monitores[0]),
    getDisplayMatching: vi.fn(() => mocks.monitores[0]),
  },
}))
vi.mock('../../main/services/configuracao.service.js', () => ({
  configuracaoService: { obter: mocks.obter, salvar: mocks.salvar },
}))
vi.mock('../../main/utils/logger.js', () => ({ logError: mocks.logError }))

import {
  carregarEstadoJanelaPrincipal,
  normalizarEstadoJanelaPrincipal,
  observarEstadoJanelaPrincipal,
} from '../../main/utils/estado-janela-principal'

describe('estado da janela principal', () => {
  beforeEach(() => {
    mocks.monitores = [{
      id: 1,
      scaleFactor: 1,
      workArea: { x: 0, y: 0, width: 2000, height: 1000 },
    }]
    mocks.obter.mockReset()
    mocks.salvar.mockReset().mockResolvedValue(undefined)
    mocks.logError.mockReset()
  })

  it('mantém os limites absolutos quando o monitor permanece compatível', () => {
    mocks.monitores = [{
      id: 1,
      scaleFactor: 1,
      workArea: { x: 0, y: 0, width: 2000, height: 1000 },
    }]

    expect(normalizarEstadoJanelaPrincipal({
      versao: 2,
      x: 600,
      y: 100,
      largura: 1200,
      altura: 800,
      monitorId: 1,
      areaMonitor: { x: 0, y: 0, largura: 2000, altura: 1000 },
      escalaMonitor: 1,
      maximizada: false,
    })).toMatchObject({ x: 600, y: 100, largura: 1200, altura: 800, monitorId: 1 })
  })

  it('recalcula limites proporcionais quando o monitor salvo não está disponível', () => {
    mocks.monitores = [{
      id: 2,
      scaleFactor: 1,
      workArea: { x: 0, y: 0, width: 1600, height: 900 },
    }]

    expect(normalizarEstadoJanelaPrincipal({
      versao: 2,
      x: 600,
      y: 100,
      largura: 1200,
      altura: 800,
      monitorId: 1,
      areaMonitor: { x: 0, y: 0, largura: 2000, altura: 1000 },
      escalaMonitor: 1,
      maximizada: false,
    })).toMatchObject({ x: 432, y: 66, largura: 1024, altura: 768, monitorId: 2 })
  })

  it('usa o estado padrão ao carregar uma configuração inválida', async () => {
    mocks.obter.mockResolvedValue('{invalido')

    await expect(carregarEstadoJanelaPrincipal()).resolves.toMatchObject({
      versao: 2,
      x: 400,
      y: 100,
      largura: 1200,
      altura: 800,
      maximizada: true,
    })
    expect(mocks.logError).toHaveBeenCalledWith('Estado da janela principal ignorado', expect.any(SyntaxError))
  })

  it('persiste os limites normais e o estado maximizado após alterações da janela', () => {
    vi.useFakeTimers()
    const eventos = new Map<string, () => void>()
    const janela = {
      isDestroyed: vi.fn().mockReturnValue(false),
      isMaximized: vi.fn().mockReturnValue(true),
      getNormalBounds: vi.fn().mockReturnValue({ x: 30, y: 40, width: 1200, height: 800 }),
      getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 2000, height: 1000 }),
      on: vi.fn((evento: string, callback: () => void) => eventos.set(evento, callback)),
      once: vi.fn((evento: string, callback: () => void) => eventos.set(evento, callback)),
    }

    observarEstadoJanelaPrincipal(janela as never)
    eventos.get('move')?.()
    vi.advanceTimersByTime(300)

    expect(mocks.salvar).toHaveBeenCalledWith(
      'janela_principal_estado',
      JSON.stringify({
        versao: 2,
        x: 30,
        y: 40,
        largura: 1200,
        altura: 800,
        monitorId: 1,
        areaMonitor: { x: 0, y: 0, largura: 2000, altura: 1000 },
        escalaMonitor: 1,
        maximizada: true,
      }),
      'json',
      'Estado da janela principal',
    )
    vi.useRealTimers()
  })
})
