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

  it('converte I-801 preservando campos condicionais para revisão', () => {
    const resultado = converterRepGdl('I-801', validarGdlRep(fixture))

    expect(resultado.codigoExame).toBe('I-801')
    if (resultado.codigoExame !== 'I-801') throw new Error('Adaptador I-801 não retornou o discriminante esperado.')
    expect(resultado.camposEspecificos.pecas).toHaveLength(3)
    expect(resultado.camposEspecificos.pecas.every(peca => peca.comuns.numeroAnalises >= 1)).toBe(true)
  })

  it('não apresenta aviso de campo condicional para extensões não mapeadas', () => {
    const rep: unknown = {
      ...structuredClone(fixture),
      pecas: [{
      codPeca: 1004,
      tipoPeca: 'CAMINHONETE(S)',
      identificacao: 'ITEM I-801',
      quantidade: '1',
      unidadeMedida: 'UNIDADE',
      numeroAnalises: '1',
      examinadoInLoco: false,
      dataEntrada: '2026-07-10',
      lacreEntrada: '',
      lacreSaida: '',
      consumida: 'Não',
      'Campo Futuro': 'preservar',
      }],
    }

    const resultado = converterRepGdl('I-801', validarGdlRep(rep))

    if (resultado.codigoExame !== 'I-801') throw new Error('Adaptador I-801 não retornou o discriminante esperado.')
    expect(resultado.avisos.some(aviso => aviso.codigo === 'CAMPOS_I801_PARA_REVISAO')).toBe(false)
    expect(resultado.camposEspecificos.pecas[0].extrasGdl).toMatchObject({ 'Campo Futuro': 'preservar' })
  })

  it('preserva candidato I-801 não certificado sem preencher o campo local', () => {
    const rep: unknown = {
      ...structuredClone(fixture),
      pecas: [{
        codPeca: 1005,
        tipoPeca: 'CAMINHONETE(S)',
        identificacao: 'ITEM I-801',
        quantidade: '1',
        unidadeMedida: 'UNIDADE',
        numeroAnalises: '1',
        examinadoInLoco: false,
        dataEntrada: '2026-07-10',
        lacreEntrada: '',
        lacreSaida: '',
        consumida: 'Não',
        placa: 'DADO-SIMULADO',
      }],
    }

    const resultado = converterRepGdl('I-801', validarGdlRep(rep))

    if (resultado.codigoExame !== 'I-801') throw new Error('Adaptador I-801 não retornou o discriminante esperado.')
    expect(resultado.avisos.some(aviso => aviso.codigo === 'CAMPOS_I801_PARA_REVISAO')).toBe(true)
    expect(resultado.camposEspecificos.pecas[0].personalizados).toEqual({})
    expect(resultado.camposEspecificos.pecas[0].extrasGdl).toMatchObject({ placa: 'DADO-SIMULADO' })
  })

  it('rejeita exame sem adaptador registrado', () => {
    expect(() => converterRepGdl('I-999', validarGdlRep(fixture)))
      .toThrow('O exame I-999 não possui adaptador de importação GDL.')
  })
})
