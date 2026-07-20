import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/gdl/rep-190-2026.json'
import { converterRepGdl } from '../../main/services/gdl-adaptadores.service'
import { validarGdlRep } from '../../main/services/gdl.schema'

describe('adaptadores de importação GDL', () => {
  it('converte B-602 pelo registro de adaptadores', () => {
    const resultado = converterRepGdl('b-602', validarGdlRep(fixture))

    expect(resultado.codigoExame).toBe('B-602')
    expect(resultado.camposEspecificos.pecas).toHaveLength(3)
  })

  it('rejeita exame sem adaptador registrado', () => {
    expect(() => converterRepGdl('I-801', validarGdlRep(fixture)))
      .toThrow('O exame I-801 não possui adaptador de importação GDL.')
  })
})
