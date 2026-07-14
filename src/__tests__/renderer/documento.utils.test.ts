import { describe, expect, it } from 'vitest'
import { buildHeaderTemplate } from '../../renderer/lib/pdf-header'
import { clampMargin, MARGINS_MAX, MARGINS_MIN } from '../../renderer/lib/margens'
import { combinarEnvolvido, separarEnvolvido } from '../../shared/utils/envolvido'

describe('utilitários gerais de documento', () => {
  it.each([
    [-1, MARGINS_MIN],
    [6, MARGINS_MAX],
    [2.04, 2],
    [2.06, 2.1],
  ])('limita e arredonda margens para valores suportados', (entrada, esperado) => {
    expect(clampMargin(entrada)).toBe(esperado)
  })

  it('constrói cabeçalho substituindo marcadores e detectando alinhamento', () => {
    const resultado = buildHeaderTemplate(
      '<p style="text-align: center">REP {{numero.rep}} — {{pagina}}/{{totalPaginas}}</p>',
      { 'numero.rep': '123/2026' },
    )

    expect(resultado.align).toBe('center')
    expect(resultado.html).toContain('{{ALIGN:center}}')
    expect(resultado.html).toContain('123/2026')
    expect(resultado.html).toContain('class="pageNumber"')
    expect(resultado.html).toContain('class="totalPages"')
  })

  it('extrai placeholders de spans do editor antes de aplicar substituições', () => {
    const resultado = buildHeaderTemplate(
      '<span class="placeholder-tag" data-placeholder="{{perito}}">texto visual obsoleto</span>',
      { perito: 'Ana' },
    )

    expect(resultado.html).toBe('{{ALIGN:flex-start}}Ana')
  })

  it('trata cabeçalho vazio e alinhamento à direita', () => {
    expect(buildHeaderTemplate('')).toEqual({ html: '', align: 'flex-start' })
    expect(buildHeaderTemplate('<p style="text-align:right">Texto</p>').align).toBe('flex-end')
  })

  it('separa e recombina qualificações sem perder o nome', () => {
    expect(separarEnvolvido('AUTOR: Maria: da Silva')).toEqual({
      qualificacao: 'AUTOR:',
      nome: 'Maria: da Silva',
    })
    expect(combinarEnvolvido('AUTOR', ' Maria ')).toBe('AUTOR: Maria')
    expect(combinarEnvolvido('AUTOR:', 'Maria')).toBe('AUTOR: Maria')
  })

  it('aceita envolvidos sem qualificação e rejeita nomes vazios', () => {
    expect(separarEnvolvido('  Maria  ')).toEqual({ qualificacao: '', nome: 'Maria' })
    expect(combinarEnvolvido('', ' Maria ')).toBe('Maria')
    expect(combinarEnvolvido('AUTOR:', '   ')).toBe('')
  })
})
