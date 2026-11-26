import { describe, expect, it } from 'vitest'
import type { MetadadosIntegracaoGdl } from '../../shared/types/b602-gdl.types'
import type { REPFormData } from '../../renderer/components/rep/exam-fields/types'
import { i801Service, lerDadosI801 } from '../../renderer/components/rep/exam-fields/services/i801.service'

describe('persistência das peças I-801', () => {
  it('normaliza itens reabertos na fronteira JSON', () => {
    const { dados } = lerDadosI801(JSON.stringify({
      i801: {
        pecas: [{
          idLocal: 'peca-1', origem: 'gdl', alteradaLocalmente: false, codPecaGdl: 1004,
          tipoCodigo: 'caminhonete', tipoPeca: 'CAMINHONETE(S)',
          comuns: {
            identificacao: 'ITEM 1', numeroAnalises: 0, quantidade: 2.5, unidadeMedida: 'UNIDADE',
            quantidadeDescricao: 'DOIS ITENS', examinadoInLoco: true, dataEntrada: '2026-11-26',
            lacreEntrada: 'E1', lacreSaida: 'S1', dataLiberacao: '2026-11-27', codigoVestigio: 'V1',
            consumida: 'P', observacao: 'Observação',
          },
          personalizados: { placa: 'ABC1D23', resultado_psa: 'positivo', ignorar: 10 },
          extrasGdl: { futuro: true },
        }, { idLocal: 1 }],
      },
    }))

    expect(dados.pecas).toEqual([expect.objectContaining({
      idLocal: 'peca-1', origem: 'gdl', codPecaGdl: 1004,
      comuns: expect.objectContaining({ numeroAnalises: 1, quantidade: 2.5, consumida: 'P' }),
      personalizados: { placa: 'ABC1D23', resultado_psa: 'positivo' },
      extrasGdl: { futuro: true },
    })])
  })

  it('rejeita JSON inválido antes de reidratar os campos', () => {
    expect(() => lerDadosI801('{')).toThrow('O conteúdo específico da REP contém JSON inválido.')
  })

  it('preserva os metadados da importação GDL ao salvar', () => {
    const metadados: MetadadosIntegracaoGdl = { origemInicial: 'gdl' }

    const serializado = i801Service.serialize({} as REPFormData, {
      i801: { dados: { pecas: [] }, raiz: { legado: true }, metadadosIntegracaoGdl: metadados },
    })

    expect(serializado).toEqual({ legado: true, i801: { pecas: [] }, integracaoGdl: metadados })
  })
})
