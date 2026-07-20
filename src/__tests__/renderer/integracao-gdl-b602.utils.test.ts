import { describe, expect, it } from 'vitest'
import type { MetadadosIntegracaoGdl } from '../../shared/types/b602-gdl.types'
import {
  extrairMetadadosIntegracaoGdl,
  extrairPecasB602,
} from '../../renderer/components/rep/exam-fields/integracao-gdl-b602.utils'

const metadadosCompletos: MetadadosIntegracaoGdl = {
  origemInicial: 'gdl',
  dadosSolicitacao: {
    orgao: 'ÓRGÃO TESTE',
    responsavel: 'RESPONSÁVEL TESTE',
    autoridade: 'AUTORIDADE TESTE',
    origensDisponiveis: [
      { tipo: 'BO', numero: '123/2026' },
      { tipo: 'IP/PM', numero: '456/2026' },
    ],
  },
  dadosInvestigacao: {
    envolvidos: ['ENVOLVIDO TESTE'],
    boletinsOcorrencia: [{ tipo: 'BO', numero: '123/2026' }],
    inqueritosPoliciais: [{ tipo: 'IP/PM', numero: '456/2026' }],
  },
  ultimaConsulta: {
    ambiente: 'homologacao',
    numeroRep: '190',
    anoRep: '2026',
    consultadoEm: '2026-07-12T12:00:00.000Z',
  },
}

describe('extrairMetadadosIntegracaoGdl', () => {
  it('reidrata todos os metadados persistidos ao reabrir a REP', () => {
    const persistido = JSON.stringify({
      b602: { pecas: [] },
      integracaoGdl: metadadosCompletos,
    })

    expect(extrairMetadadosIntegracaoGdl(persistido)).toEqual(metadadosCompletos)
  })

  it('mantém compatibilidade com metadados antigos que possuem somente a origem', () => {
    const persistido = JSON.stringify({ integracaoGdl: { origemInicial: 'manual' } })

    expect(extrairMetadadosIntegracaoGdl(persistido)).toEqual({ origemInicial: 'manual' })
  })

  it('converte a lista legada de candidatas para origens disponíveis', () => {
    const persistido = JSON.stringify({
      integracaoGdl: {
        origemInicial: 'gdl',
        dadosSolicitacao: {
          orgao: 'ÓRGÃO TESTE',
          responsavel: '',
          autoridade: '',
          origensCandidatasSolicitacao: [{ tipo: 'BO', numero: '123/2026' }],
        },
      },
    })

    expect(extrairMetadadosIntegracaoGdl(persistido)?.dadosSolicitacao?.origensDisponiveis)
      .toEqual([{ tipo: 'BO', numero: '123/2026' }])
  })

  it('rejeita metadados inválidos vindos da fronteira JSON', () => {
    const persistido = JSON.stringify({
      integracaoGdl: {
        ...metadadosCompletos,
        dadosSolicitacao: {
          ...metadadosCompletos.dadosSolicitacao,
          origensDisponiveis: [{ tipo: 'BO', numero: 123 }],
        },
      },
    })

    expect(extrairMetadadosIntegracaoGdl(persistido)).toBeNull()
    expect(extrairMetadadosIntegracaoGdl('{json inválido')).toBeNull()
  })
})

describe('extrairPecasB602', () => {
  it('normaliza Mat. Incinerado? como Não ao reabrir uma peça legada', () => {
    const persistido = JSON.stringify({
      b602: {
        pecas: [{
          idLocal: 'peca-legada',
          origem: 'manual',
          tipoPeca: 'PISTOLA(S)',
          comuns: {},
          personalizados: {},
          extrasGdl: {},
        }],
      },
    })

    expect(extrairPecasB602(persistido)[0]?.comuns.materialIncinerado).toBe('N')
  })
})
