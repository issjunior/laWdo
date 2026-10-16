import { describe, expect, it } from 'vitest'
import {
  cn,
  converterPlaceholdersTextuais,
  placeholderChaveEhValida,
  removerFormatacaoPlaceholders,
  segmentarTextoComPlaceholders,
} from '../../renderer/lib/utils'
import { CHAVES_PLACEHOLDERS_REP } from '../../renderer/lib/indice-placeholders'

describe('utilitários gerais de placeholders', () => {
  it('normaliza placeholder comum colado como código mantendo a formatação do parágrafo', () => {
    const html = '<p style="font-family: Arial; font-size: 12pt"><strong>Origem:</strong> <code>{{solicitante_nome}}</code>.</p>'
    const primeira = converterPlaceholdersTextuais(html, CHAVES_PLACEHOLDERS_REP)
    const segunda = converterPlaceholdersTextuais(primeira, CHAVES_PLACEHOLDERS_REP)
    const doc = new DOMParser().parseFromString(segunda, 'text/html')
    expect(doc.querySelector('code')).toBeNull()
    expect(doc.querySelector('p')?.style.fontFamily).toBe('Arial')
    expect(doc.querySelector('p')?.style.fontSize).toBe('12pt')
    expect(doc.querySelector('strong')?.textContent).toBe('Origem:')
    expect(doc.querySelectorAll('.placeholder-tag[data-placeholder="{{solicitante_nome}}"]')).toHaveLength(1)
    expect(removerFormatacaoPlaceholders(segunda)).toContain('{{solicitante_nome}}')
  })

  it('preserva código real, placeholders desconhecidos e blocos pré-formatados', () => {
    const html = '<p><code>const nome = 1</code> <code>{{desconhecido}}</code></p><pre><code>{{solicitante_nome}}</code></pre>'
    const resultado = converterPlaceholdersTextuais(html, CHAVES_PLACEHOLDERS_REP)
    const doc = new DOMParser().parseFromString(resultado, 'text/html')
    expect(doc.querySelectorAll('code')).toHaveLength(3)
    expect(doc.querySelector('pre code')?.textContent).toBe('{{solicitante_nome}}')
  })

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
