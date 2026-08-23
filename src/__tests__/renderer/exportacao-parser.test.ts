import { describe, expect, it } from 'vitest';
import { parseHtmlParaEstrutura } from '../../renderer/lib/exportacao-parser';

describe('parseHtmlParaEstrutura', () => {
  it('preserva estilos aninhados, listas, tabela mesclada, figura e elementos semânticos', () => {
    const documento = parseHtmlParaEstrutura(`
      <h2>Seção</h2><p style="text-align:justify;line-height:1.5;margin-left:12pt">
      <strong>Negrito <em style="color:#123456;background-color:#ffee00">e itálico</em></strong><sup>2</sup>&nbsp;<a href="https://exemplo.test">link</a></p>
      <ol><li>Primeiro<ul><li>Filho</li></ul></li></ol>
      <table><tr><th colspan="2" style="background-color:#eeeeee">Cabeçalho</th></tr><tr><td rowspan="2">A</td><td>B</td></tr></table>
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
    if (tabela?.tipo === 'tabela') expect(tabela.linhas[0][0]).toMatchObject({ colspan: 2, corFundo: 'EEEEEE' });
    expect(blocos).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'linha-horizontal' }), expect.objectContaining({ tipo: 'figura', larguraPx: 320, alturaPx: 180 })]));
  });
});
