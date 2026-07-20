import { describe, expect, it } from 'vitest'
import { projetarB602ParaLaudo } from '@shared/utils/b602-pecas-projecao'
import type { PecaB602 } from '@shared/types/b602-gdl.types'

function criarPeca(sobrescritas: Partial<PecaB602> = {}): PecaB602 {
  return {
    idLocal: 'peca-1',
    origem: 'gdl',
    alteradaLocalmente: false,
    tipoCodigo: '104',
    tipoPeca: 'PISTOLA(S)',
    comuns: {
      identificacao: 'Pistola apreendida',
      quantidade: 1,
      unidadeMedida: 'UNIDADES',
      quantidadeDescricao: '',
      examinadoInLoco: false,
      materialIncinerado: 'N',
      dataEntrada: '',
      lacreEntrada: 'LACRE-1',
      lacreSaida: '',
      dataLiberacao: '',
      codigoVestigio: '',
      consumida: 'N',
      observacao: '',
    },
    personalizados: {
      '104:marca_arma': 'Taurus',
      '104:modelo': 'G3',
      '104:numero_serie': 'ABC123',
      '104:calibre_nominal': '9mm Luger',
      '104:funcionamento': 'Eficiente',
    },
    extrasGdl: {},
    ...sobrescritas,
  }
}

describe('projetarB602ParaLaudo', () => {
  it('deriva material encaminhado e armas da coleção canônica', () => {
    const resultado = projetarB602ParaLaudo({ pecas: [criarPeca()] })

    expect(resultado.materialEncaminhado).toEqual([expect.objectContaining({
      natureza: 'Arma', tipo: 'PISTOLA(S)', quantidade: '1',
      dito_oficio: 'Pistola apreendida', numero_lacre: 'LACRE-1',
    })])
    expect(resultado.armas).toEqual([expect.objectContaining({
      tipo: 'PISTOLA(S)', marca: 'Taurus', modelo: 'G3', calibre: '9mm Luger',
      numeracao_serie: 'ABC123', funcionamento: 'Eficiente', func_toggle: 'on',
    })])
  })

  it('deriva estojos canônicos e mantém leitura das coleções legadas', () => {
    const estojo = criarPeca({
      tipoCodigo: '101',
      tipoPeca: 'ESTOJO(S)',
      personalizados: { '101:origem_coleta': '94' },
    })
    const canonico = projetarB602ParaLaudo({ pecas: [estojo] })
    const legado = projetarB602ParaLaudo({
      material_enc: [{ tipo: 'Pistola' }],
      cartuchos: [{ calibre: '.40' }],
      estojos: [{ calibre: '9mm' }],
      armas: [{ tipo: 'Revólver' }],
    })

    expect(canonico.estojos).toEqual([expect.objectContaining({
      quantidade: '1', origem: 'NECRÓPSIA', estojo: 'Pistola apreendida',
    })])
    expect(legado).toEqual({
      materialEncaminhado: [{ tipo: 'Pistola' }],
      cartuchos: [{ calibre: '.40' }],
      estojos: [{ calibre: '9mm' }],
      armas: [{ tipo: 'Revólver' }],
    })
  })
})
