import { describe, expect, it } from 'vitest'
import {
  getClasseSecaoEstrutural,
  normalizarTituloSecao,
  parsearSecoesEstruturais,
  reconstruirHtmlEstrutural,
  reindexarHtmlEstrutural,
  type SecaoEstruturalLaudo,
} from '../../renderer/lib/estrutura-laudo'

describe('estrutura semântica do laudo', () => {
  it.each([
    ['1. Introdução', 'Introdução'],
    ['2.3 Metodologia', 'Metodologia'],
    ['a) Material', 'Material'],
    ['  Conclusão  ', 'Conclusão'],
  ])('normaliza títulos numerados sem alterar o conteúdo semântico', (entrada, esperado) => {
    expect(normalizarTituloSecao(entrada)).toBe(esperado)
  })

  it('representa HTML vazio como uma seção editável', () => {
    expect(parsearSecoesEstruturais('   ')).toEqual([
      { nivel: 2, titulo: 'Conteúdo', conteudo: '<p>&nbsp;</p>' },
    ])
  })

  it('preserva conteúdo anterior ao primeiro heading e reconhece metadados estruturais', () => {
    const secoes = parsearSecoesEstruturais([
      '<p>Preâmbulo</p>',
      '<h2 data-secao-id="metodo" data-titulo-base="Método">1. Método</h2>',
      '<p>Descrição</p>',
      '<h3 data-secao-id="arma" data-parent-id="metodo" data-derivada-rep="true">1.1 Arma</h3>',
    ].join(''))

    expect(secoes).toEqual([
      { nivel: 2, titulo: 'Conteúdo', conteudo: '<p>Preâmbulo</p>' },
      {
        id: 'metodo',
        parentId: null,
        nivel: 2,
        titulo: 'Método',
        conteudo: '<p>Descrição</p>',
        derivadaRep: false,
      },
      {
        id: 'arma',
        parentId: 'metodo',
        nivel: 3,
        titulo: 'Arma',
        conteudo: '<p>&nbsp;</p>',
        derivadaRep: true,
      },
    ])
  })

  it('reconstrói headings numerados, metadados escapados e conteúdo padrão', () => {
    const secoes: SecaoEstruturalLaudo[] = [
      { id: 'a&b', nivel: 2, titulo: '1. Exame <geral>', conteudo: '<p>Texto</p>' },
      { id: 'sub', parentId: 'a&b', nivel: 3, titulo: 'a) Armas', conteudo: '' },
      { id: 'fim', nivel: 2, titulo: 'Conclusão', conteudo: '<p>Fim</p>' },
    ]

    const html = reconstruirHtmlEstrutural(secoes)
    const documento = new DOMParser().parseFromString(html, 'text/html')
    const headings = Array.from(documento.querySelectorAll('h2, h3'))

    expect(headings.map(({ textContent }) => textContent)).toEqual([
      '1. Exame <geral>',
      '1.1 Armas',
      '2. Conclusão',
    ])
    expect(headings[0].getAttribute('data-secao-id')).toBe('a&b')
    expect(headings[1].getAttribute('data-parent-id')).toBe('a&b')
    expect(documento.querySelector('h3 + p')?.innerHTML).toBe('&nbsp;')
  })

  it('mantém o significado das seções em um ciclo de reconstrução e leitura', () => {
    const originais: SecaoEstruturalLaudo[] = [
      { id: 'um', nivel: 2, titulo: 'Resultados', conteudo: '<p>Resultado</p>' },
      { id: 'dois', parentId: 'um', nivel: 3, titulo: 'Cartuchos', conteudo: '<p>Dois</p>' },
    ]

    const relidas = parsearSecoesEstruturais(reconstruirHtmlEstrutural(originais))

    expect(relidas).toEqual(originais.map((secao) => ({
      ...secao,
      parentId: secao.parentId ?? null,
      derivadaRep: false,
    })))
  })

  it('reindexa apenas headings reconhecidos como estruturais', () => {
    const html = reindexarHtmlEstrutural([
      '<h2>9. Primeiro</h2>',
      '<h3>Subtítulo livre</h3>',
      '<h3 data-secao-id="sub">9.8 Segundo</h3>',
      '<h2 data-titulo-base="Terceiro">99. Ignorado</h2>',
    ].join(''))
    const documento = new DOMParser().parseFromString(html, 'text/html')

    expect(Array.from(documento.querySelectorAll('h2, h3')).map(({ textContent }) => textContent)).toEqual([
      '1. Primeiro',
      'Subtítulo livre',
      '1.1 Segundo',
      '2. Terceiro',
    ])
  })

  it('seleciona classes por nível e domínio sem depender de acentuação', () => {
    expect(getClasseSecaoEstrutural({ nivel: 2, titulo: 'Armas' })).toContain('bg-card')
    expect(getClasseSecaoEstrutural({ nivel: 3, titulo: 'Cartuchos' })).toContain('border-sky-300')
    expect(getClasseSecaoEstrutural({ nivel: 3, titulo: 'Estójos' })).toContain('border-emerald-300')
    expect(getClasseSecaoEstrutural({ nivel: 3, titulo: 'Armas de fogo' })).toContain('border-amber-300')
    expect(getClasseSecaoEstrutural({ nivel: 3, titulo: 'Outros' })).toContain('bg-card')
  })
})
