import { describe, expect, it } from 'vitest'
import {
  resolverApresentacaoTipoSolicitacao,
  resolverSelecaoTipoSolicitacao,
  resolverValorSelectTipoSolicitacao,
} from '../../renderer/components/rep/TipoSolicitacaoSelect'

describe('resolverApresentacaoTipoSolicitacao', () => {
  it('exibe IP/PM diretamente mesmo quando a lista dinâmica de origens está vazia', () => {
    const resultado = resolverApresentacaoTipoSolicitacao(
      'IP/PM',
      [],
      true,
    )

    expect(resultado).toMatchObject({ modoOutro: false, valorSelect: 'IP/PM' })
    expect(resultado.opcoes).toContain('IP/PM')
  })

  it('aceita no preenchimento manual qualquer tipo existente no catálogo do GDL', () => {
    const resultado = resolverApresentacaoTipoSolicitacao('CARTA PRECATÓRIA', [], false)

    expect(resultado).toMatchObject({ modoOutro: false, valorSelect: 'CARTA PRECATÓRIA' })
    expect(resultado.opcoes).toContain('CARTA PRECATÓRIA')
  })

  it('preserva um valor GDL desconhecido sem convertê-lo para Outros', () => {
    const resultado = resolverApresentacaoTipoSolicitacao('ORIGEM NOVA GDL', [], true)

    expect(resultado).toMatchObject({ modoOutro: false, valorSelect: 'ORIGEM NOVA GDL' })
    expect(resultado.opcoes).toContain('ORIGEM NOVA GDL')
  })

  it('mantém os valores locais como opções normais', () => {
    expect(resolverApresentacaoTipoSolicitacao('Ofício', [], false)).toMatchObject({
      modoOutro: false,
      valorSelect: 'Ofício',
    })
  })

  it('mantém um valor manual realmente livre no modo Outros', () => {
    expect(resolverApresentacaoTipoSolicitacao('TIPO PARTICULAR', [], false)).toMatchObject({
      modoOutro: true,
      valorSelect: 'Outros',
    })
  })

  it('identifica uma origem pelo conjunto exato de tipo e número', () => {
    const origens = [
      { tipo: 'BO', numero: '100/2026' },
      { tipo: 'BO', numero: '200/2026' },
    ]

    const valorSelect = resolverValorSelectTipoSolicitacao('BO', '200/2026', origens)

    expect(valorSelect).toBe('origem-gdl:1')
    expect(resolverSelecaoTipoSolicitacao(valorSelect ?? '', origens)).toEqual(origens[1])
  })

  it('não associa um número manual a uma origem diferente', () => {
    expect(resolverValorSelectTipoSolicitacao(
      'BO',
      '300/2026',
      [{ tipo: 'BO', numero: '100/2026' }],
    )).toBeUndefined()
  })
})
