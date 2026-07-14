import { describe, expect, it } from 'vitest'
import {
  CATALOGO_TIPOS_ORIGEM_GDL,
  LABELS_TIPOS_ORIGEM_GDL,
} from '../../shared/catalogos/tipos-origem-gdl.catalogo'

describe('catálogo de tipos de origem do GDL', () => {
  it('mantém os códigos necessários para BO e IP/PM', () => {
    expect(CATALOGO_TIPOS_ORIGEM_GDL).toEqual(expect.arrayContaining([
      { codigo: '2', label: 'BO' },
      { codigo: '4', label: 'IP/PM' },
    ]))
  })

  it('não possui códigos nem labels duplicados', () => {
    const codigos = CATALOGO_TIPOS_ORIGEM_GDL.map(tipo => tipo.codigo)

    expect(new Set(codigos).size).toBe(codigos.length)
    expect(new Set(LABELS_TIPOS_ORIGEM_GDL).size).toBe(LABELS_TIPOS_ORIGEM_GDL.length)
  })
})
