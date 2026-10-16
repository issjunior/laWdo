import { describe, expect, it } from 'vitest';
import { buildHtml } from '../../main/services/secao-builder.service';
import { parsearSecoesEstruturais, reconstruirHtmlEstrutural, reindexarHtmlEstrutural } from '../../renderer/lib/estrutura-laudo';
import { ocultarTitulosSecoesNaSaida } from '../../renderer/lib/titulos-secoes-laudo';
import { parseHtmlParaEstrutura } from '../../renderer/lib/exportacao-parser';

function gerarHtml() {
  const base = { template_id: 'template', created_at: '', updated_at: '' };
  return buildHtml([
    { ...base, id: 'inicio', nome: 'INTRODUÇÃO', ordem: 0, ocultar_titulo: 1, conteudo: '<h3>Título dentro do conteúdo</h3><p>Texto inicial</p>' },
    { ...base, id: 'filho', parent_id: 'inicio', nome: 'SUBSEÇÃO VISÍVEL', ordem: 1, conteudo: '<p>Texto filho</p>' },
    { ...base, id: 'fim', nome: 'CONCLUSÃO', ordem: 2, conteudo: '<p>Texto final</p>' },
    { ...base, id: 'subfim', parent_id: 'fim', nome: 'SUBSEÇÃO OCULTA', ordem: 3, ocultar_titulo: 1, conteudo: '<h4 data-repeat-item="arma">ARMA A</h4><p>Texto preservado</p>' },
  ], new Map(), {});
}

describe('ocultação dos títulos de seção', () => {
  it('preserva a escolha de não contar após salvar e deixa filhos visíveis sem número', () => {
    const base = { template_id: 'template', created_at: '', updated_at: '' };
    const html = buildHtml([
      { ...base, id: 'inicio', nome: 'INÍCIO', ordem: 0, ocultar_titulo: 1, contar_na_numeracao: 0, conteudo: '<p>Texto inicial</p>' },
      { ...base, id: 'filho', parent_id: 'inicio', nome: 'SUBSEÇÃO', ordem: 1, conteudo: '<p>Texto filho</p>' },
      { ...base, id: 'fim', nome: 'CONCLUSÃO', ordem: 2, conteudo: '<p>Texto final</p>' },
    ], new Map(), {});
    const secoes = parsearSecoesEstruturais(html);
    expect(secoes[0].contarNaNumeracao).toBe(false);
    const reconstruido = reindexarHtmlEstrutural(reconstruirHtmlEstrutural(secoes));
    expect(parsearSecoesEstruturais(reconstruido)).toEqual(secoes);
    const documento = new DOMParser().parseFromString(reconstruido, 'text/html');
    expect(Array.from(documento.querySelectorAll('h2, h3')).map(titulo => titulo.textContent)).toEqual(['INÍCIO', 'SUBSEÇÃO', '1. CONCLUSÃO']);
    expect(ocultarTitulosSecoesNaSaida(reconstruido)).toContain('Texto inicial');
    const reexibido = reconstruirHtmlEstrutural(secoes.map(secao => ({ ...secao, ocultarTitulo: false })));
    expect(reexibido).toContain('2. CONCLUSÃO');
    expect(parsearSecoesEstruturais(reexibido)[0].contarNaNumeracao).toBe(false);
    const estruturaExportada = JSON.stringify(parseHtmlParaEstrutura(reconstruido));
    expect(estruturaExportada).not.toContain('INÍCIO');
    expect(estruturaExportada).toContain('1. CONCLUSÃO');
  });

  it('preserva limites, preferência e numeração após reconstrução e reabertura', () => {
    const html = gerarHtml();
    const secoes = parsearSecoesEstruturais(html);
    expect(secoes.map(secao => secao.id)).toEqual(['inicio', 'filho', 'fim', 'subfim']);
    expect(secoes.map(secao => secao.ocultarTitulo === true)).toEqual([true, false, false, true]);
    const reconstruido = reindexarHtmlEstrutural(reconstruirHtmlEstrutural(secoes));
    expect(parsearSecoesEstruturais(reconstruido)).toEqual(secoes);
    expect(reconstruido).toContain('1. INTRODUÇÃO');
    expect(reconstruido).toContain('1.1 SUBSEÇÃO VISÍVEL');
    expect(reconstruido).toContain('2. CONCLUSÃO');
    expect(reconstruido).toContain('2.1 SUBSEÇÃO OCULTA');
  });

  it('omite somente os cabeçalhos marcados, sem parágrafo vazio ou alteração do original', () => {
    const html = gerarHtml();
    const saida = ocultarTitulosSecoesNaSaida(html);
    const documento = new DOMParser().parseFromString(saida, 'text/html');
    expect(documento.body.firstElementChild?.textContent).toBe('Título dentro do conteúdo');
    expect(saida).not.toContain('INTRODUÇÃO');
    expect(saida).not.toContain('SUBSEÇÃO OCULTA');
    expect(saida).toContain('1.1 SUBSEÇÃO VISÍVEL');
    expect(saida).toContain('2. CONCLUSÃO');
    expect(saida).toContain('Texto inicial');
    expect(saida).toContain('Texto filho');
    expect(saida).toContain('Texto preservado');
    expect(saida).toContain('ARMA A');
    expect(saida).not.toContain('<p></p>');
    expect(html).toContain('1. INTRODUÇÃO');
    expect(ocultarTitulosSecoesNaSaida(saida)).toBe(saida);
  });

  it('não altera laudos antigos sem a preferência', () => {
    const html = '<h2>1. PREÂMBULO</h2><p>Texto</p><h2>2. OBJETIVO</h2>';
    expect(ocultarTitulosSecoesNaSaida(html)).toBe(html);
  });

  it('exclui títulos ocultos da estrutura DOCX/ODT, preservando os demais blocos', () => {
    const documento = parseHtmlParaEstrutura(gerarHtml());
    const texto = JSON.stringify(documento);
    expect(texto).not.toContain('INTRODUÇÃO');
    expect(texto).not.toContain('SUBSEÇÃO OCULTA');
    expect(texto).toContain('2. CONCLUSÃO');
    expect(texto).toContain('Texto preservado');
    expect(documento.secoes[0].blocos.some(bloco => bloco.tipo === 'linha-horizontal')).toBe(false);
  });
});
