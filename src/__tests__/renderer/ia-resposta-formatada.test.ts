import { describe, expect, it } from 'vitest'
import { extrairTabelaMarkdownIa, tabelaMarkdownParaHtmlSeguro, tabelaMarkdownParaTexto } from '@/lib/ia-resposta-formatada'

describe('ia-resposta-formatada', () => {
  const tabela = '| Arma | Exame |\n| --- | --- |\n| A | Prestabilidade |\n| B | Coleta |'

  it('reconhece tabela Markdown e preserva as células', () => {
    expect(extrairTabelaMarkdownIa(tabela)).toEqual({
      cabecalho: ['Arma', 'Exame'],
      linhas: [['A', 'Prestabilidade'], ['B', 'Coleta']],
    })
  })

  it('produz HTML escapado e texto tabulado para cópia', () => {
    expect(tabelaMarkdownParaHtmlSeguro(tabela)).toContain('<table>')
    expect(tabelaMarkdownParaTexto(tabela)).toBe('Arma\tExame\nA\tPrestabilidade\nB\tColeta')
  })
})
