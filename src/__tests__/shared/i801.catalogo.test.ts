import { describe, expect, it } from 'vitest'
import { obterPendenciaPecaI801 } from '../../shared/catalogos/i801.catalogo'

describe('catálogo I-801', () => {
  const criarPeca = (sobrescrita: Partial<{ tipoCodigo: string; unidadeMedida: string; dataEntrada: string }> = {}) => ({
    tipoCodigo: 'caminhonete',
    comuns: { unidadeMedida: 'UNIDADE', dataEntrada: '2026-10-21' },
    ...sobrescrita,
  })

  it('exige somente os campos obrigatórios do item I-801', () => {
    expect(obterPendenciaPecaI801(criarPeca())).toBeUndefined()
    expect(obterPendenciaPecaI801(criarPeca({ tipoCodigo: '' }))).toBe('Tipo do item obrigatório')
    expect(obterPendenciaPecaI801(criarPeca({ comuns: { unidadeMedida: '', dataEntrada: '2026-10-21' } }))).toBe('Medida obrigatória')
    expect(obterPendenciaPecaI801(criarPeca({ comuns: { unidadeMedida: 'UNIDADE', dataEntrada: '' } }))).toBe('Data de entrada obrigatória')
  })
})
