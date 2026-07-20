import { describe, expect, it } from 'vitest'
import type { PecaB602 } from '../../shared/types/b602-gdl.types'
import {
  mesclarPecasB602DoGdl,
  montarItensReconciliacaoPecasB602,
  obterPecasImportadasAusentesDoGdl,
} from '../../renderer/components/rep/exam-fields/pecas-b602.utils'

function criarPeca(parcial: Partial<PecaB602> = {}): PecaB602 {
  return {
    idLocal: 'peca-local',
    origem: 'gdl',
    alteradaLocalmente: false,
    codPecaGdl: 1001,
    tipoCodigo: '476',
    tipoPeca: 'CARABINA(S)',
    comuns: {
      identificacao: '', quantidade: 1, unidadeMedida: '', quantidadeDescricao: '',
      examinadoInLoco: false, materialIncinerado: 'N', dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '',
      codigoVestigio: '', consumida: 'N', observacao: '',
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

  it('identifica somente peças importadas ausentes na resposta completa do GDL', () => {
    const presente = criarPeca({ idLocal: 'presente', codPecaGdl: 1001 })
    const ausente = criarPeca({ idLocal: 'ausente', codPecaGdl: 1002 })
    const manual = criarPeca({ idLocal: 'manual', origem: 'manual', codPecaGdl: undefined })
    const retornoCompleto = [criarPeca({ idLocal: 'nova-consulta', codPecaGdl: 1001 })]

    expect(obterPecasImportadasAusentesDoGdl(
      [presente, ausente, manual],
      retornoCompleto,
    )).toEqual([ausente])
  })

  it('remove importadas ausentes somente após confirmação explícita', () => {
    const presente = criarPeca({ idLocal: 'presente', codPecaGdl: 1001 })
    const ausente = criarPeca({ idLocal: 'ausente', codPecaGdl: 1002 })
    const manual = criarPeca({ idLocal: 'manual', origem: 'manual', codPecaGdl: undefined })
    const recebida = criarPeca({ idLocal: 'nova-consulta', codPecaGdl: 1001 })

    const semConfirmacao = mesclarPecasB602DoGdl(
      [presente, ausente, manual], [recebida], true,
    )
    const comConfirmacao = mesclarPecasB602DoGdl(
      [presente, ausente, manual], [recebida], true, true,
    )

    expect(semConfirmacao.map(peca => peca.idLocal)).toEqual(['presente', 'ausente', 'manual'])
    expect(comConfirmacao.map(peca => peca.idLocal)).toEqual(['presente', 'manual'])
  })

  it('não remove peça apenas desmarcada pelo usuário quando ela está na resposta completa', () => {
    const primeira = criarPeca({ idLocal: 'primeira', codPecaGdl: 1001 })
    const segunda = criarPeca({ idLocal: 'segunda', codPecaGdl: 1002 })
    const primeiraRecebida = criarPeca({ idLocal: 'nova-primeira', codPecaGdl: 1001 })
    const segundaRecebida = criarPeca({ idLocal: 'nova-segunda', codPecaGdl: 1002 })

    const resultado = mesclarPecasB602DoGdl(
      [primeira, segunda],
      [primeiraRecebida],
      true,
      true,
      [primeiraRecebida, segundaRecebida],
    )

    expect(resultado.map(peca => peca.idLocal)).toEqual(['primeira', 'segunda'])
  })

  it('monta a revisão com peças retornadas e importadas ausentes', () => {
    const presente = criarPeca({ idLocal: 'presente', codPecaGdl: 1001 })
    const ausente = criarPeca({ idLocal: 'ausente', codPecaGdl: 1002 })
    const manual = criarPeca({ idLocal: 'manual', origem: 'manual', codPecaGdl: undefined })
    const retorno = criarPeca({ idLocal: 'retorno', codPecaGdl: 1001 })
    const nova = criarPeca({ idLocal: 'nova', codPecaGdl: 1003 })

    expect(montarItensReconciliacaoPecasB602(
      [presente, ausente, manual], [retorno, nova],
    )).toEqual([
      expect.objectContaining({ chave: 'gdl-1001', peca: retorno, jaImportada: true, retornadaPeloGdl: true }),
      expect.objectContaining({ chave: 'gdl-1003', peca: nova, jaImportada: false, retornadaPeloGdl: true }),
      expect.objectContaining({ chave: 'gdl-1002', peca: ausente, jaImportada: true, retornadaPeloGdl: false }),
    ])
  })
})
