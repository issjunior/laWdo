import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  lerLarguraPainelPersistida,
  limitarLarguraPainel,
} from '@/hooks/use-largura-painel-persistida'

describe('persistência da largura dos painéis laterais', () => {
  beforeEach(() => window.localStorage.clear())

  it('usa o padrão quando o valor está ausente ou corrompido', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    expect(lerLarguraPainelPersistida('painel', 460, 360, 640)).toBe(460)
    vi.mocked(window.localStorage.getItem).mockReturnValue('inválido')
    expect(lerLarguraPainelPersistida('painel', 460, 360, 640)).toBe(460)
  })

  it('aceita valores válidos e limita valores fora da faixa', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('512')
    expect(lerLarguraPainelPersistida('painel', 460, 360, 640)).toBe(512)
    vi.mocked(window.localStorage.getItem).mockReturnValue('100')
    expect(lerLarguraPainelPersistida('painel', 460, 360, 640)).toBe(360)
    vi.mocked(window.localStorage.getItem).mockReturnValue('900')
    expect(lerLarguraPainelPersistida('painel', 460, 360, 640)).toBe(640)
    expect(limitarLarguraPainel(380, 320, 720)).toBe(380)
  })
})
