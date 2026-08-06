import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  monitores: [] as Array<{
    id: number
    scaleFactor: number
    workArea: { x: number; y: number; width: number; height: number }
  }>,
}))

vi.mock('electron', () => ({
  screen: {
    getAllDisplays: vi.fn(() => mocks.monitores),
    getPrimaryDisplay: vi.fn(() => mocks.monitores[0]),
    getDisplayMatching: vi.fn(() => mocks.monitores[0]),
  },
}))
vi.mock('../../main/services/configuracao.service.js', () => ({
  configuracaoService: { obter: vi.fn(), salvar: vi.fn() },
}))
vi.mock('../../main/utils/logger.js', () => ({ logError: vi.fn() }))

import { normalizarEstadoJanelaPrincipal } from '../../main/utils/estado-janela-principal'

describe('estado da janela principal', () => {
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
})
