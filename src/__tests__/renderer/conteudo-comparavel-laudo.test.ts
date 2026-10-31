import { describe, expect, it } from 'vitest';
import { normalizarConteudoComparavel } from '@/lib/conteudo-comparavel-laudo';
import { removerFormatacaoPlaceholders } from '@/lib/utils';

describe('conteúdo comparável do laudo', () => {
  it('ignora o ocultamento temporário da âncora e remove a prévia sem apagar outros estilos', () => {
    const original = '<p><span data-placeholder="{{tabela}}" style="color: red;">{{tabela}}</span></p>';
    const apresentado = '<p><span data-placeholder="{{tabela}}" data-placeholder-preview-id="p1" style="color: red; display: none;">{{tabela}}</span></p>'
      + '<div data-placeholder-preview="true" data-placeholder-preview-id="p1"><table><tr><td>REP</td></tr></table></div>';
    expect(normalizarConteudoComparavel(apresentado)).toBe(normalizarConteudoComparavel(original));
    expect(removerFormatacaoPlaceholders(apresentado)).not.toContain('display: none');
    expect(removerFormatacaoPlaceholders(apresentado)).toContain('color: red');
    expect(normalizarConteudoComparavel('<p style="display: none;">Texto</p>'))
      .not.toBe(normalizarConteudoComparavel('<p>Texto</p>'));
  });

  it('preserva tabela personalizada e seu conteúdo ao comparar dados e chaves', () => {
    const ancora = '<span data-placeholder="{{tabela}}" data-placeholder-tabela-personalizada-id="t1">{{tabela}}</span>';
    const tabela = '<div data-placeholder-tabela-personalizada="true" data-placeholder-tabela-personalizada-id="t1"><table><tr><td>Editado</td></tr></table></div>';
    const dados = ancora.replace('data-placeholder=', 'style="display: none;" data-placeholder=') + tabela;
    const chaves = ancora + tabela.replace('<div ', '<div style="display: none;" ');
    expect(normalizarConteudoComparavel(chaves)).toBe(normalizarConteudoComparavel(dados));
    expect(normalizarConteudoComparavel(chaves)).toContain('Editado');
    expect(normalizarConteudoComparavel(chaves.replace('Editado', 'Outra edição')))
      .not.toBe(normalizarConteudoComparavel(dados));
  });

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

it('a atualização das referências da coleta não cria alteração pendente sem mudar o texto', () => {
  const original = '<div data-b601-coleta="true" data-b601-referencias="antigo"><span data-b601-exame-coleta="true">20/2026</span></div>';
  expect(normalizarConteudoComparavel(original.replace('antigo', 'atual'))).toBe(normalizarConteudoComparavel(original));
  expect(normalizarConteudoComparavel(original.replace('20/2026', '21/2026'))).not.toBe(normalizarConteudoComparavel(original));
});

it('ignora quebras entre a âncora oculta da tabela e os blocos ao salvar antes de Atualizar REP', () => {
  const ancora = '<span data-placeholder="{{b601_tabela_material_coleta}}" data-placeholder-tabela-personalizada-id="t1" style="display: none">{{b601_tabela_material_coleta}}</span>';
  const tabela = '<div data-placeholder-tabela-personalizada="true" data-placeholder-tabela-personalizada-id="t1"><table><tbody><tr><td>20/2026</td></tr></tbody></table></div>';
  const semQuebras = ancora + tabela + '<h2>Do exame</h2>';
  const comQuebras = ancora + '\n' + tabela + '\n<h2>Do exame</h2>';
  expect(normalizarConteudoComparavel(comQuebras)).toBe(normalizarConteudoComparavel(semQuebras));
  expect(normalizarConteudoComparavel(comQuebras.replace('20/2026', '21/2026'))).not.toBe(normalizarConteudoComparavel(semQuebras));
});

it.each(['data-b601-grupo="105"', 'data-placeholder-tabela-personalizada="true"', 'class="cond-bloco" data-cond-bloco="exame"'])(
  'limpa controles por identidade estável mesmo sem classes transitórias: %s', atributos => {
    const original = `<div ${atributos}><table><tbody><tr><td>Texto</td></tr></tbody></table></div>`;
    const apresentado = original.replace('<td>', '<td contenteditable="true">');
    const limpo = normalizarConteudoComparavel(apresentado);
    expect(limpo).toBe(normalizarConteudoComparavel(original));
    expect(normalizarConteudoComparavel(limpo)).toBe(limpo);
    expect(normalizarConteudoComparavel(apresentado.replace('Texto', 'Editado'))).not.toBe(limpo);
  },
);

it('ignora somente a trava transitória de placeholders e mantém travas de conteúdo comum', () => {
  const html = '<span data-placeholder="{{nome}}">{{nome}}</span>';
  expect(normalizarConteudoComparavel(html.replace('<span ', '<span contenteditable="false" '))).toBe(normalizarConteudoComparavel(html));
  expect(normalizarConteudoComparavel('<p contenteditable="false">Texto</p>')).not.toBe(normalizarConteudoComparavel('<p>Texto</p>'));
});
