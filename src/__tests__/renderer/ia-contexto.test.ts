import { describe, expect, it } from 'vitest'

import { resolverHtmlContextoIa, resolverTextoContextoIa } from '@/lib/ia-contexto'
import { criarChaveMemoriaConsultaIa } from '@/lib/ia-consulta-contexto'

describe('contexto resolvido da IA', () => {
  it('substitui placeholders por dados reais sem alterar o HTML original', () => {
    const html = '<p>Na data de <span data-placeholder="{{data_extenso_recebimento_rep}}">{{data_extenso_recebimento_rep}}</span>, em {{cidade}}.</p>'
    const resultado = resolverTextoContextoIa(html, {
      data_extenso_recebimento_rep: {
        chave: 'data_extenso_recebimento_rep',
        valor: '4 de agosto de 2026',
        preenchido: true,
        formato: 'texto',
      },
      cidade: {
        chave: 'cidade',
        valor: 'Curitiba',
        preenchido: true,
        formato: 'texto',
      },
    })

    expect(resultado).toBe('Na data de 4 de agosto de 2026, em Curitiba.')
    expect(html).toContain('{{data_extenso_recebimento_rep}}')
  })

  it('identifica dados ausentes sem enviar a sintaxe de placeholder', () => {
    const resultado = resolverTextoContextoIa('<p>{{campo_ausente}}</p>', {})

    expect(resultado).toBe('[dado não preenchido: campo_ausente]')
    expect(resultado).not.toContain('{{')
  })

  it('preserva a tabela ao resolver placeholders para consulta factual', () => {
    const resultado = resolverHtmlContextoIa('<table><tbody><tr><td>{{arma}}</td><td><span data-placeholder="{{exame}}">{{exame}}</span></td></tr></tbody></table>', {
      arma: { chave: 'arma', valor: 'Revólver', preenchido: true, formato: 'texto' },
      exame: { chave: 'exame', valor: 'Prestabilidade', preenchido: true, formato: 'texto' },
    })

    expect(resultado).toContain('<table>')
    expect(resultado).toContain('Revólver')
    expect(resultado).toContain('Prestabilidade')
    expect(resultado).not.toContain('{{')
  })

  it('isola a memória consultiva quando o fingerprint do escopo muda', () => {
    const memoria = new Map<string, Array<{ pergunta: string; resposta: string }>>()
    const chaveAnterior = criarChaveMemoriaConsultaIa('secao', 2, 'fingerprint-anterior')
    const chaveAtual = criarChaveMemoriaConsultaIa('secao', 2, 'fingerprint-atual')
    memoria.set(chaveAnterior, [{ pergunta: 'Qual é a arma?', resposta: 'Arma A.' }])

    expect(chaveAtual).not.toBe(chaveAnterior)
    expect(memoria.get(chaveAtual)).toBeUndefined()
  })
})
