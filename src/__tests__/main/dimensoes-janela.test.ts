import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  salvar: vi.fn(),
}))

vi.mock('electron', () => ({
  screen: {
    getDisplayMatching: vi.fn(() => ({ workAreaSize: { width: 1200, height: 800 } })),
    getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 1200, height: 800 } })),
  },
}))
vi.mock('../../main/services/configuracao.service.js', () => ({
  configuracaoService: { obter: vi.fn(), salvar: mocks.salvar },
}))
vi.mock('../../main/utils/logger.js', () => ({ logError: vi.fn() }))

import {
  normalizarDimensoesJanela,
  observarDimensoesJanela,
} from '../../main/utils/dimensoes-janela'

const opcoes = {
  larguraPadrao: 460,
  alturaPadrao: 720,
  larguraMinima: 360,
  alturaMinima: 480,
}

describe('dimensões das janelas destacadas', () => {
  afterEach(() => vi.useRealTimers())

  it('usa os padrões para configuração ausente ou inválida', () => {
    expect(normalizarDimensoesJanela(null, opcoes, { width: 1600, height: 1000 }))
      .toEqual({ versao: 1, largura: 460, altura: 720 })
    expect(normalizarDimensoesJanela({ versao: 2, largura: 800, altura: 800 }, opcoes, { width: 1600, height: 1000 }))
      .toEqual({ versao: 1, largura: 460, altura: 720 })
    expect(normalizarDimensoesJanela({ versao: 1, largura: 800, altura: 'inválida' }, opcoes, { width: 1600, height: 1000 }))
      .toEqual({ versao: 1, largura: 460, altura: 720 })
  })

  it('limita valores persistidos entre os mínimos e 90% da área útil', () => {
    expect(normalizarDimensoesJanela(
      { versao: 1, largura: 100, altura: 5000 },
      opcoes,
      { width: 1200, height: 800 },
    )).toEqual({ versao: 1, largura: 360, altura: 720 })
  })

  it('grava somente uma vez após 300 ms da última alteração', async () => {
    vi.useFakeTimers()
    mocks.salvar.mockResolvedValue(undefined)
    const eventos = new Map<string, () => void>()
    let tamanho: [number, number] = [500, 600]
    const janela = {
      on: vi.fn((evento: string, callback: () => void) => eventos.set(evento, callback)),
      once: vi.fn((evento: string, callback: () => void) => eventos.set(evento, callback)),
      getSize: vi.fn(() => tamanho),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: tamanho[0], height: tamanho[1] })),
      isDestroyed: vi.fn(() => false),
    }

    observarDimensoesJanela(janela as never, {
      chave: 'janela_teste',
      descricao: 'Janela de teste',
      larguraMinima: 360,
      alturaMinima: 480,
    })
    eventos.get('resize')?.()
    tamanho = [550, 650]
    eventos.get('resize')?.()

    await vi.advanceTimersByTimeAsync(299)
    expect(mocks.salvar).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.salvar).toHaveBeenCalledTimes(1)
    expect(mocks.salvar).toHaveBeenCalledWith(
      'janela_teste',
      JSON.stringify({ versao: 1, largura: 550, altura: 650 }),
      'json',
      'Janela de teste',
    )
  })
})
