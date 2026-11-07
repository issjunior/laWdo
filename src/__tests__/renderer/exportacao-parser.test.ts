import { describe, expect, it } from 'vitest';
import { parseHtmlParaEstrutura } from '../../renderer/lib/exportacao-parser';

describe('parseHtmlParaEstrutura', () => {
  it('mescla a célula da figura solitária em um laudo antigo', () => {
    const documento = parseHtmlParaEstrutura('<table><tr><td><p>&nbsp;</p></td><td><figure class="laudo-figure" style="text-align:center">'
      + '<img width="280" src="data:image/png;base64,aGVsbG8="><figcaption>Figura 01</figcaption></figure></td></tr></table>');
    const tabela = documento.secoes[0].blocos[0];
    expect(tabela.tipo).toBe('tabela');
    if (tabela.tipo !== 'tabela') return;
    expect(tabela.linhas[0]).toHaveLength(1);
    expect(tabela.linhas[0][0].colspan).toBe(2);
    expect(tabela.linhas[0][0].blocos).toEqual([expect.objectContaining({ tipo: 'figura', larguraPx: 280, alinhamento: 'center' })]);
  });

  it('marca figuras de um par fotográfico com a altura padrão na exportação', () => {
    const documento = parseHtmlParaEstrutura('<table><tr><td><figure class="laudo-figure"><img width="100" height="200" src="data:image/png;base64,aGVsbG8="></figure></td>'
      + '<td><figure class="laudo-figure"><img width="300" height="100" src="data:image/png;base64,aGVsbG8="></figure></td></tr></table>');
    const tabela = documento.secoes[0].blocos[0];
    expect(tabela.tipo).toBe('tabela');
    if (tabela.tipo !== 'tabela') return;
    expect(tabela.linhas.flatMap(linha => linha).flatMap(celula => celula.blocos || []))
      .toEqual([
        expect.objectContaining({ tipo: 'figura', alturaParPercentual: 109, ajusteVisualPar: 'conter', larguraPx: undefined, alturaPx: undefined }),
        expect.objectContaining({ tipo: 'figura', alturaParPercentual: 109, ajusteVisualPar: 'conter', larguraPx: undefined, alturaPx: undefined }),
      ]);
  });

  it.each([
    ['conter-3x2', 67],
    ['conter-4x3', 75],
    ['conter-1x1', 100],
    ['valor-invalido', 109],
  ] as const)('migra o enquadramento semântico %s para %s%%', (valor, esperado) => {
    const documento = parseHtmlParaEstrutura(`<table><tr data-layout-figuras="${valor}"><td><figure class="laudo-figure"><img src="data:image/png;base64,aGVsbG8="></figure></td><td><figure class="laudo-figure"><img src="data:image/png;base64,aGVsbG8="></figure></td></tr></table>`);
    const tabela = documento.secoes[0].blocos[0];
    expect(tabela.tipo).toBe('tabela');
    if (tabela.tipo !== 'tabela') return;
    const figuras = tabela.linhas.flatMap(linha => linha).flatMap(celula => celula.blocos || [])
      .filter(bloco => bloco.tipo === 'figura');
    expect(figuras.map(figura => figura.alturaParPercentual)).toEqual([esperado, esperado]);
  });

  it('preserva percentuais intermediários do slider', () => {
    const documento = parseHtmlParaEstrutura('<table><tr data-altura-par-figuras="125"><td><figure class="laudo-figure"><img src="data:image/png;base64,aGVsbG8="></figure></td><td><figure class="laudo-figure"><img src="data:image/png;base64,aGVsbG8="></figure></td></tr></table>');
    const tabela = documento.secoes[0].blocos[0];
    expect(tabela.tipo).toBe('tabela');
    if (tabela.tipo !== 'tabela') return;
    const figuras = tabela.linhas.flatMap(linha => linha).flatMap(celula => celula.blocos || [])
      .filter(bloco => bloco.tipo === 'figura');
    expect(figuras.map(figura => figura.alturaParPercentual)).toEqual([125, 125]);
  });

  it('preserva a escolha de foto inteira no par', () => {
    const documento = parseHtmlParaEstrutura('<table><tr data-ajuste-visual-par="conter"><td><figure class="laudo-figure"><img src="data:image/png;base64,aGVsbG8="></figure></td><td><figure class="laudo-figure"><img src="data:image/png;base64,aGVsbG8="></figure></td></tr></table>');
    const tabela = documento.secoes[0].blocos[0];
    expect(tabela.tipo).toBe('tabela');
    if (tabela.tipo !== 'tabela') return;
    const figuras = tabela.linhas.flatMap(linha => linha).flatMap(celula => celula.blocos || [])
      .filter(bloco => bloco.tipo === 'figura');
    expect(figuras.map(figura => figura.ajusteVisualPar)).toEqual(['conter', 'conter']);
  });

  it('preserva zero, converte pixels e expande abreviações das margens de parágrafo', () => {
    const blocos = parseHtmlParaEstrutura('<p style="margin-top:0pt;margin-bottom:0pt;line-height:1.7">Zero</p><p style="margin:8px 0 16px">Pixels</p><p style="margin:0">Abreviação</p><p>Sem ajuste</p>').secoes[0].blocos;
    expect(blocos[0]).toMatchObject({ espacamentoAntesPt: 0, espacamentoDepoisPt: 0, espacamentoLinha: 1.7 });
    expect(blocos[1]).toMatchObject({ espacamentoAntesPt: 6, espacamentoDepoisPt: 12 });
    expect(blocos[2]).toMatchObject({ espacamentoAntesPt: 0, espacamentoDepoisPt: 0 });
    expect(blocos[3]).toMatchObject({ espacamentoAntesPt: undefined, espacamentoDepoisPt: undefined });
  });
  it('justifica parágrafos comuns sem sobrescrever alinhamentos explícitos ou títulos', () => {
    const blocos = parseHtmlParaEstrutura('<h2>Título</h2><p>Texto</p><p style="text-align:center">Centralizado</p><table><tr><td><p>Célula</p></td></tr></table>').secoes[0].blocos;
    expect(blocos[0]).toMatchObject({ tipo: 'paragrafo', alinhamento: undefined });
    expect(blocos[1]).toMatchObject({ tipo: 'paragrafo', alinhamento: 'justify' });
    expect(blocos[2]).toMatchObject({ tipo: 'paragrafo', alinhamento: 'center' });
    const tabela = blocos[3];
    expect(tabela).toMatchObject({ tipo: 'tabela' });
    if (tabela.tipo === 'tabela') expect(tabela.linhas[0][0].paragrafos[0].alinhamento).toBeUndefined();
  });
  it('preserva estilos aninhados, listas, tabela mesclada, figura e elementos semânticos', () => {
    const documento = parseHtmlParaEstrutura(`
      <h2>Seção</h2><p style="text-align:justify;line-height:1.5;margin-left:12pt">
      <strong>Negrito <em style="color:#123456;background-color:#ffee00">e itálico</em></strong><sup>2</sup>&nbsp;<a href="https://exemplo.test">link</a></p>
      <ol><li>Primeiro<ul><li>Filho</li></ul></li></ol>
      <table><tr><th colspan="2" style="background-color:#eeeeee">Cabeçalho</th></tr><tr><td rowspan="2" style="background-color:#000000">A</td><td>B</td></tr></table>
      <blockquote>citação</blockquote><pre>  código</pre><hr>
      <figure style="text-align:center"><img width="320" height="180" src="data:image/png;base64,aGVsbG8="><figcaption>Figura 1: teste</figcaption></figure>`);

    const blocos = documento.secoes[0].blocos;
    expect(blocos).toHaveLength(9);
    const paragrafo = blocos[1];
    expect(paragrafo).toMatchObject({ tipo: 'paragrafo', alinhamento: 'justify', espacamentoLinha: 1.5, recuoEsquerdoPt: 12 });
    if (paragrafo.tipo === 'paragrafo') {
      expect(paragrafo.trechos).toEqual(expect.arrayContaining([
        expect.objectContaining({ texto: 'e itálico', estilo: expect.objectContaining({ negrito: true, italico: true, cor: '123456', realce: 'FFEE00' }) }),
        expect.objectContaining({ texto: 'link', estilo: expect.objectContaining({ link: 'https://exemplo.test' }) }),
      ]));
    }
    expect(blocos.filter(b => b.tipo === 'lista')).toHaveLength(2);
    const tabela = blocos.find(b => b.tipo === 'tabela');
    expect(tabela).toMatchObject({ tipo: 'tabela' });
    if (tabela?.tipo === 'tabela') {
      expect(tabela.linhas[0][0]).toMatchObject({ colspan: 2, corFundo: 'EEEEEE' });
      expect(tabela.linhas[1][0].corFundo).toBeUndefined();
    }
    expect(blocos).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'linha-horizontal' }), expect.objectContaining({ tipo: 'figura', larguraPx: 320, alturaPx: 180 })]));
  });

  it('normaliza marcadores legados e preserva a quebra de página entre blocos', () => {
    const documento = parseHtmlParaEstrutura(
      '<p style="text-indent:28.35pt">Antes</p><!-- pagebreak --><p>Depois</p>'
    );

    expect(documento.secoes[0].blocos).toEqual([
      expect.objectContaining({ tipo: 'paragrafo', recuoPrimeiraLinhaPt: 28.35 }),
      { tipo: 'quebra-pagina' },
      expect.objectContaining({ tipo: 'paragrafo' }),
    ]);
  });

  it('preserva texto direto, formatação inline e blocos mistos nas células', () => {
    const documento = parseHtmlParaEstrutura(`
      <table>
        <caption>TABELA 1 – Material</caption>
        <tr><th colspan="2">TABELA 1 – MATERIAL</th></tr>
        <tr><td>Cartucho <strong>calibre 12</strong></td><td>Antes<p>Detalhe</p>Depois</td></tr>
      </table>
    `);
    const [legenda, tabela] = documento.secoes[0].blocos;

    expect(legenda).toMatchObject({ tipo: 'paragrafo', trechos: [expect.objectContaining({ texto: 'TABELA 1 – Material' })] });
    expect(tabela).toMatchObject({ tipo: 'tabela' });
    if (tabela.tipo !== 'tabela') return;
    expect(tabela.linhas[0][0].paragrafos[0].trechos.map(trecho => trecho.texto).join('')).toBe('TABELA 1 – MATERIAL');
    expect(tabela.linhas[1][0].paragrafos[0].trechos).toEqual(expect.arrayContaining([
      expect.objectContaining({ texto: 'calibre 12', estilo: expect.objectContaining({ negrito: true }) }),
    ]));
    expect(tabela.linhas[1][1].paragrafos.map(paragrafo => paragrafo.trechos.map(trecho => trecho.texto).join('')))
      .toEqual(['Antes', 'Detalhe', 'Depois']);
  });
});
