import { describe, expect, it } from 'vitest'
import {
  cn,
  converterPlaceholdersTextuais,
  placeholderChaveEhValida,
  removerFormatacaoPlaceholders,
  segmentarTextoComPlaceholders,
} from '../../renderer/lib/utils'

describe('utilitários gerais de placeholders', () => {
  it('aceita chaves exatas e instâncias numéricas de chaves indexadas', () => {
    const chaves = new Set(['numero_rep', 'envolvido_N_nome'])

    expect(placeholderChaveEhValida('numero_rep', chaves)).toBe(true)
    expect(placeholderChaveEhValida('envolvido_0_nome', chaves)).toBe(true)
    expect(placeholderChaveEhValida('envolvido_27_nome', chaves)).toBe(true)
    expect(placeholderChaveEhValida('envolvido_x_nome', chaves)).toBe(false)
    expect(placeholderChaveEhValida('numero_laudo', chaves)).toBe(false)
  })

  it('segmenta o texto sem perder conteúdo e diferencia placeholders desconhecidos', () => {
    const texto = 'REP {{numero_rep}} — {{desconhecido}}.'

    const segmentos = segmentarTextoComPlaceholders(texto, ['numero_rep'])

    expect(segmentos).toEqual([
      { tipo: 'texto', valor: 'REP ' },
      { tipo: 'placeholder', valor: '{{numero_rep}}' },
      { tipo: 'texto', valor: ' — ' },
      { tipo: 'texto', valor: '{{desconhecido}}' },
      { tipo: 'texto', valor: '.' },
    ])
    expect(segmentos.map(({ valor }) => valor).join('')).toBe(texto)
  })

  it('converte apenas placeholders válidos em elementos não editáveis', () => {
    const resultado = converterPlaceholdersTextuais(
      '<p>Laudo {{numero}} / {{ignorado}}</p>',
      ['numero'],
    )
    const documento = new DOMParser().parseFromString(resultado, 'text/html')
    const convertido = documento.querySelector('[data-placeholder="{{numero}}"]')

    expect(convertido?.classList.contains('placeholder-tag')).toBe(true)
    expect(convertido?.getAttribute('contenteditable')).toBe('false')
    expect(convertido?.textContent).toBe('{{numero}}')
    expect(documento.body.textContent).toContain('{{ignorado}}')
  })

  it('preserva elementos já convertidos ao executar a conversão novamente', () => {
    const original = '<span class="placeholder-tag" data-placeholder="{{numero}}">{{numero}}</span>'

    const resultado = converterPlaceholdersTextuais(original, ['numero'])
    const documento = new DOMParser().parseFromString(resultado, 'text/html')

    expect(documento.querySelectorAll('.placeholder-tag')).toHaveLength(1)
    expect(documento.querySelector('.placeholder-tag .placeholder-tag')).toBeNull()
  })

  it('converte campos reservados de forma idempotente e sem diferenciar maiúsculas', () => {
    const primeiraConversao = converterPlaceholdersTextuais('<p>XXX e xxx</p>', [], true)
    const segundaConversao = converterPlaceholdersTextuais(primeiraConversao, [], true)
    const documento = new DOMParser().parseFromString(segundaConversao, 'text/html')

    expect(documento.querySelectorAll('.campo-reservado')).toHaveLength(2)
    expect(documento.body.textContent).toBe('XXX e xxx')
  })

  it('remove os metadados transitórios de tooltip antes de salvar', () => {
    const resultado = removerFormatacaoPlaceholders(
      '<span class="campo-reservado" data-reservado="true" data-tooltip-xxx="true" data-origem-xxx="template" title="Campo de preenchimento manual no template" aria-label="Campo de preenchimento manual no template">XXX</span>',
    )
    const documento = new DOMParser().parseFromString(resultado, 'text/html')
    const campo = documento.querySelector('.campo-reservado')

    expect(campo?.getAttribute('data-reservado')).toBe('true')
    expect(campo?.hasAttribute('data-tooltip-xxx')).toBe(false)
    expect(campo?.hasAttribute('data-origem-xxx')).toBe(false)
    expect(campo?.hasAttribute('title')).toBe(false)
  })

  it('remove o botão visual de supressão antes de salvar o laudo', () => {
    const resultado = removerFormatacaoPlaceholders(
      '<div data-bloco-pericial="funcionamento"><button data-acao-suprimir-bloco="true">×</button><p>Texto pericial</p></div>',
    )

    expect(resultado).not.toContain('data-acao-suprimir-bloco')
    expect(resultado).toContain('Texto pericial')
  })

  it('combina classes condicionais e resolve conflitos Tailwind', () => {
    expect(cn('px-2 text-sm', false && 'hidden', 'px-4')).toBe('text-sm px-4')
  })
})
