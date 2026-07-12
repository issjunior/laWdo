import { describe, expect, it } from 'vitest'
import type { PecaB602 } from '../../shared/types/b602-gdl.types'
import { mesclarPecasB602DoGdl } from '../../renderer/components/rep/exam-fields/pecas-b602.utils'

function criarPeca(parcial: Partial<PecaB602> = {}): PecaB602 {
  return {
    idLocal: 'peca-local',
    origem: 'gdl',
    alteradaLocalmente: false,
    codPecaGdl: 1001,
    tipoCodigo: '476',
    tipoPeca: 'CARABINA(S)',
    comuns: {
      identificacao: '', numeroAnalises: '', quantidade: 1, unidadeMedida: '', quantidadeDescricao: '',
      examinadoInLoco: false, dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '',
      codigoVestigio: '', consumida: '', observacao: '',
    },
    personalizados: {},
    extrasGdl: {},
    ...parcial,
  }
}

describe('mesclarPecasB602DoGdl', () => {
  it('completa somente os campos vazios de uma peça importada existente', () => {
    const atual = criarPeca({
      comuns: { ...criarPeca().comuns, identificacao: 'LOCAL' },
      personalizados: { '476:marca': '', '476:modelo': 'MODELO LOCAL' },
    })
    const recebida = criarPeca({
      idLocal: 'peca-gdl-nova',
      comuns: { ...criarPeca().comuns, identificacao: 'GDL', unidadeMedida: 'UNIDADE' },
      personalizados: { '476:marca': 'MARCA GDL', '476:modelo': 'MODELO GDL' },
    })

    const [resultado] = mesclarPecasB602DoGdl([atual], [recebida], false)

    expect(resultado.idLocal).toBe('peca-local')
    expect(resultado.comuns.identificacao).toBe('LOCAL')
    expect(resultado.comuns.unidadeMedida).toBe('UNIDADE')
    expect(resultado.personalizados).toEqual({ '476:marca': 'MARCA GDL', '476:modelo': 'MODELO LOCAL' })
  })

  it('preserva peça alterada localmente durante a mesclagem', () => {
    const atual = criarPeca({ alteradaLocalmente: true, comuns: { ...criarPeca().comuns, identificacao: 'EDITADA' } })
    const recebida = criarPeca({ comuns: { ...criarPeca().comuns, identificacao: 'GDL' } })

    const [resultado] = mesclarPecasB602DoGdl([atual], [recebida], false)

    expect(resultado).toBe(atual)
  })

  it('substitui uma peça importada sem remover peças manuais', () => {
    const importada = criarPeca({ comuns: { ...criarPeca().comuns, identificacao: 'ANTIGA' } })
    const manual = criarPeca({ idLocal: 'peca-manual', origem: 'manual', codPecaGdl: undefined, tipoPeca: 'ESTOJO(S)', tipoCodigo: '101' })
    const recebida = criarPeca({ idLocal: 'nova-consulta', comuns: { ...criarPeca().comuns, identificacao: 'ATUALIZADA' } })

    const resultado = mesclarPecasB602DoGdl([importada, manual], [recebida], true)

    expect(resultado).toHaveLength(2)
    expect(resultado[0]).toMatchObject({ idLocal: 'peca-local', comuns: { identificacao: 'ATUALIZADA' } })
    expect(resultado[1]).toBe(manual)
  })
})
