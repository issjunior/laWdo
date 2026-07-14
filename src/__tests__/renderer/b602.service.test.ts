import { describe, expect, it } from 'vitest'
import type { MetadadosIntegracaoGdl, PecaB602 } from '../../shared/types/b602-gdl.types'
import type { REPFormData } from '../../renderer/components/rep/exam-fields/types'
import { b602Service } from '../../renderer/components/rep/exam-fields/services/b602.service'
import {
  deserializeCamposEspecificos,
  serializeCamposEspecificos,
} from '../../renderer/components/rep/exam-fields'
import {
  extrairMetadadosIntegracaoGdl,
  extrairPecasB602,
} from '../../renderer/components/rep/exam-fields/integracao-gdl-b602.utils'

function criarFormulario(campos: Partial<REPFormData>): REPFormData {
  return new Proxy(
    campos,
    {
      get(alvo, propriedade: string) {
        return alvo[propriedade] ?? ''
      },
    },
  ) as REPFormData
}

describe('b602Service', () => {
  it('persiste e reabre a Unidade Policial preenchida a partir do Solicitante', () => {
    const serializado = b602Service.serialize(
      criarFormulario({ b602_solicitante_nome: 'UNIDADE POLICIAL TESTE' }),
    )

    expect(serializado).toMatchObject({
      b602: { solicitante_nome: 'UNIDADE POLICIAL TESTE' },
    })
    expect(b602Service.deserialize(serializado)).toMatchObject({
      b602_solicitante_nome: 'UNIDADE POLICIAL TESTE',
    })
  })

  it('faz round-trip canônico de peças e metadados sem recriar arrays legados', () => {
    const peca: PecaB602 = {
      idLocal: 'peca-gdl-1',
      origem: 'gdl',
      alteradaLocalmente: false,
      codPecaGdl: 1001,
      tipoCodigo: '476',
      tipoPeca: 'CARABINA(S)',
      comuns: {
        identificacao: 'CARABINA TESTE',
        numeroAnalises: '',
        quantidade: 1,
        unidadeMedida: 'UNIDADE',
        quantidadeDescricao: '',
        examinadoInLoco: false,
        dataEntrada: '',
        lacreEntrada: '',
        lacreSaida: '',
        dataLiberacao: '',
        codigoVestigio: '',
        consumida: 'N',
        observacao: '',
      },
      personalizados: { '476:numero-serie': 'ABC123' },
      extrasGdl: {},
    }
    const metadados: MetadadosIntegracaoGdl = {
      origemInicial: 'gdl',
      dadosSolicitacao: {
        orgao: 'UNIDADE POLICIAL TESTE',
        responsavel: 'RESPONSÁVEL TESTE',
        autoridade: 'AUTORIDADE TESTE',
        origensDisponiveis: [{ tipo: 'BO', numero: '123/2026' }],
      },
      dadosInvestigacao: {
        envolvidos: ['ENVOLVIDO TESTE'],
        boletinsOcorrencia: [{ tipo: 'BO', numero: '123/2026' }],
        inqueritosPoliciais: [],
      },
    }
    const formulario = criarFormulario({
      b602_solicitante_nome: 'UNIDADE POLICIAL TESTE',
      b602_material_enc_0_natureza: 'Arma',
      b602_cartuchos_toggle: 'on',
      b602_estojos_toggle: 'on',
      b602_armas_toggle: 'on',
      b602_armas_0_tipo: 'Pistola',
    })

    const serializado = serializeCamposEspecificos('B-602', formulario, {
      b602: { pecas: [peca], metadadosIntegracaoGdl: metadados },
    })

    expect(serializado).toBeDefined()
    const persistido: unknown = JSON.parse(serializado ?? '')
    expect(persistido).toMatchObject({
      b602: {
        solicitante_nome: 'UNIDADE POLICIAL TESTE',
        pecas: [peca],
      },
      integracaoGdl: metadados,
    })
    expect(persistido).not.toMatchObject({ b602: { material_enc: expect.anything() } })
    expect(persistido).not.toMatchObject({ b602: { cartuchos: expect.anything() } })
    expect(persistido).not.toMatchObject({ b602: { estojos: expect.anything() } })
    expect(persistido).not.toMatchObject({ b602: { armas: expect.anything() } })
    expect(extrairPecasB602(serializado)).toEqual([peca])
    expect(extrairMetadadosIntegracaoGdl(serializado)).toEqual(metadados)
    expect(deserializeCamposEspecificos('B-602', serializado)).toMatchObject({
      b602_solicitante_nome: 'UNIDADE POLICIAL TESTE',
    })
  })
})
