import { describe, expect, it } from 'vitest'
import { CATALOGO_TIPOS_PECA_B602, pecaB602EstaCompleta } from '../../shared/catalogos/b602-gdl.catalogo'

describe('catálogo B602', () => {
  it('possui exatamente os 17 códigos únicos e não contém zero', () => {
    const codigos = CATALOGO_TIPOS_PECA_B602.map(tipo => tipo.codigo)
    expect(codigos).toHaveLength(17)
    expect(new Set(codigos).size).toBe(17)
    expect(codigos).not.toContain('0')
  })

  it('mantém somente CARABINA e ESTOJO como round-trip confirmado', () => {
    const confirmados = CATALOGO_TIPOS_PECA_B602.filter(tipo => tipo.roundTripConfirmado).map(tipo => tipo.codigo)
    expect(confirmados).toEqual(['476', '101'])
  })

  it('exige os campos personalizados obrigatórios na completude', () => {
    expect(pecaB602EstaCompleta({ tipoCodigo: '476', comuns: { quantidade: 1 }, personalizados: {} })).toBe(false)
    expect(pecaB602EstaCompleta({ tipoCodigo: '476', comuns: { quantidade: 1 }, personalizados: { '476:arma_institucional': '60' } })).toBe(true)
  })
})
