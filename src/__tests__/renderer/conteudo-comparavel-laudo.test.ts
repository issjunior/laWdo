import { describe, expect, it } from 'vitest';
import { normalizarConteudoComparavel } from '@/lib/conteudo-comparavel-laudo';

describe('conteúdo comparável do laudo', () => {
  it('ignora quantidades de espaços entre blocos estruturais sem apagar espaços inline', () => {
    const salvo = '<h2>Título</h2>\n<p>Texto</p>\n<h3>Detalhes</h3>';
    const editor = '<h2>Título</h2>\n\n<p>Texto</p>\n\n<h3>Detalhes</h3>';
    expect(normalizarConteudoComparavel(editor)).toBe(normalizarConteudoComparavel(salvo));
    expect(normalizarConteudoComparavel('<span>Um</span> <span>Dois</span>'))
      .not.toBe(normalizarConteudoComparavel('<span>Um</span><span>Dois</span>'));
  });

  it('ignora a apresentação dos placeholders e os atributos internos do editor', () => {
    const original = '<p><span data-placeholder="nome">nome</span></p>';
    const apresentado = '<p data-mce-style=""><span class="campo-reservado" data-reservado="true" data-placeholder-apresentacao="dados" data-placeholder="nome">XXX</span></p>';
    expect(normalizarConteudoComparavel(apresentado)).toBe(normalizarConteudoComparavel(original));
  });

  it('compara atributos em ordem diferente sem apagar a formatação', () => {
    const original = '<p class="texto" style="text-align: right;">Texto</p>';
    expect(normalizarConteudoComparavel('<p style="text-align: right;" class="texto">Texto</p>'))
      .toBe(normalizarConteudoComparavel(original));
    expect(normalizarConteudoComparavel('<p class="texto">Texto</p>'))
      .not.toBe(normalizarConteudoComparavel(original));
  });

  it.each([
    ['<p>Texto</p>', '<p>Alterado</p>'],
    ['<p>Texto</p>', '<p><strong>Texto</strong></p>'],
    ['<img src="a.png">', '<img src="b.png">'],
    ['<table><tbody><tr><td>A</td></tr></tbody></table>', '<table><tbody><tr><td>B</td></tr></tbody></table>'],
  ])('preserva alterações de conteúdo relevantes', (original, alterado) => {
    expect(normalizarConteudoComparavel(alterado)).not.toBe(normalizarConteudoComparavel(original));
  });
});
