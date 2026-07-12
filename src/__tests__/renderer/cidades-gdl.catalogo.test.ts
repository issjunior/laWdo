import { describe, expect, it } from 'vitest'
import { CIDADES_GDL } from '../../renderer/components/rep/exam-fields/catalogos/cidades-gdl.catalogo'

describe('catálogo de cidades do GDL', () => {
  it('reproduz as 400 opções do seletor de cidades do GDL', () => {
    expect(CIDADES_GDL).toHaveLength(400)
    expect(CIDADES_GDL).toContain('LONDRINA')
    expect(CIDADES_GDL).toContain('CIDADE FORA DO PARANÁ')
  })
})
