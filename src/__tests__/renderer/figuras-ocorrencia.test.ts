import { describe, expect, it } from 'vitest';
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import { atualizarNumeroFigura, centralizarFigurasSozinhas, centralizarFigurasSozinhasHtml, corrigirMolduraVaziaLocalNecropsia, legendaFiguraAusente, localizarFiguraPorIndice, reindexarFiguras, renumerarFigurasNosEditores, restaurarLegendaFigura } from '../../renderer/lib/figuras';
import { criarHtmlFigura } from '../../renderer/lib/figura-html';

describe('ocorrências de figuras', () => {
  it.each(['esquerda', 'direita'] as const)('centraliza a figura restante após excluir a da %s', lado => {
    const documento = new DOMParser().parseFromString(
      '<table border="0" style="width:100%"><colgroup><col style="width:50%"><col style="width:50%"></colgroup>'
      + '<tbody><tr><td style="border:0;text-align:center"><figure class="laudo-figure" data-dummy="true">'
      + '<img src="dummy.png" style="width:280px;height:auto"><figcaption>Figura 01</figcaption></figure></td>'
      + '<td style="border:0;text-align:center"><figure class="laudo-figure"><img src="real.png">'
      + '<figcaption>Figura 02: <strong>Detalhe</strong></figcaption></figure></td></tr></tbody></table>',
      'text/html',
    );
    const celulas = documento.querySelectorAll('td');
    celulas[lado === 'esquerda' ? 0 : 1].querySelector('figure')?.remove();
    expect(centralizarFigurasSozinhas(documento.body)).toBe(true);
    const restante = documento.querySelector('td');
    expect(documento.querySelectorAll('td')).toHaveLength(1);
    expect(restante?.colSpan).toBe(2);
    expect(restante?.style.textAlign).toBe('center');
    expect(restante?.querySelector('figure')?.getAttribute('style')).toContain('margin-left: auto');
    expect(documento.querySelector('colgroup')?.children).toHaveLength(2);
    expect(restante?.getAttribute('style')).toContain('border:0');
    expect(restante?.querySelector('img')?.getAttribute('style')).toBe(lado === 'direita' ? 'width:280px;height:auto' : null);
    expect(restante?.querySelector('figcaption')?.innerHTML).toBe(lado === 'esquerda' ? 'Figura 02: <strong>Detalhe</strong>' : 'Figura 01');
    expect(centralizarFigurasSozinhas(documento.body)).toBe(false);
  });

  it('preserva quadros com duas figuras e células com outro conteúdo', () => {
    const duas = '<table><tr><td><figure class="laudo-figure"><img></figure></td><td><figure class="laudo-figure"><img></figure></td></tr></table>';
    const texto = '<table><tr><td><figure class="laudo-figure"><img></figure></td><td><p>Descrição</p></td></tr></table>';
    expect(centralizarFigurasSozinhasHtml(duas)).toBe(duas);
    expect(centralizarFigurasSozinhasHtml(texto)).toBe(texto);
  });

  it('corrige a moldura herdada sem perder a foto substituída ou duplicá-la no painel', () => {
    const html = '<table><tr><td><figure class="laudo-figure" data-image-id="dummy-b601-local-necropsia-material-apresentado-1" data-dummy="true">'
      + '<figure class="laudo-figure" data-image-id="foto-real"><img src="foto.png"><figcaption>Figura 02: Embalagem</figcaption></figure>'
      + '</figure></td><td><figure class="laudo-figure" data-image-id="outra-foto"><img src="outra.png">'
      + '<figcaption>Figura 03: Lacre</figcaption></figure></td></tr></table>';
    const corrigido = reindexarFiguras(corrigirMolduraVaziaLocalNecropsia(html));
    const documento = new DOMParser().parseFromString(corrigido, 'text/html');
    const figuras = Array.from(documento.querySelectorAll('figure.laudo-figure'));
    expect(figuras).toHaveLength(2);
    expect(figuras.map(figura => figura.getAttribute('data-image-id'))).toEqual(['foto-real', 'outra-foto']);
    expect(figuras.map(figura => figura.querySelector('figcaption')?.textContent)).toEqual(['Figura 01: Embalagem', 'Figura 02: Lacre']);
    expect(figuras[0].querySelector('img')?.getAttribute('src')).toBe('foto.png');
    expect(corrigirMolduraVaziaLocalNecropsia(corrigido)).toBe(corrigido);
  });

  it('preserva figuras fora da moldura vazia reconhecida', () => {
    const html = '<figure class="laudo-figure" data-image-id="outra-moldura" data-dummy="true">'
      + '<figure class="laudo-figure"><img src="foto.png"><figcaption>Figura 01</figcaption></figure></figure>';
    expect(corrigirMolduraVaziaLocalNecropsia(html)).toBe(html);
  });

  it('localiza a segunda ocorrência mesmo quando ambas usam o mesmo arquivo', () => {
    const primeiro = document.createElement('div');
    primeiro.innerHTML = '<figure class="laudo-figure" data-image-id="foto"><img></figure>';
    const segundo = document.createElement('div');
    segundo.innerHTML = '<figure class="laudo-figure" data-image-id="foto"><img></figure>';
    const editores = [primeiro, segundo].map(body => ({ getBody: () => body }) as unknown as TinyMceEditorInstance);
    expect(localizarFiguraPorIndice(editores, 0)?.figura).toBe(primeiro.querySelector('figure'));
    expect(localizarFiguraPorIndice(editores, 1)?.figura).toBe(segundo.querySelector('figure'));
    expect(localizarFiguraPorIndice(editores, 2)).toBeNull();
  });

  it('usa a moldura das dummies e numera figuras manuais junto das existentes', () => {
    const manual = criarHtmlFigura('data:image/png;base64,AA==', 'manual', 'Vista frontal');
    const dummy = criarHtmlFigura('data:image/svg+xml;base64,BB==', 'dummy', '', true);
    const documento = new DOMParser().parseFromString(reindexarFiguras(`<section>${dummy}</section><section>${manual}</section>`), 'text/html');
    const figuras = Array.from(documento.querySelectorAll('.laudo-figure'));
    expect(figuras.map(figura => figura.querySelector('figcaption')?.textContent)).toEqual(['Figura 01', 'Figura 02: Vista frontal']);
    expect(figuras[0].querySelector('img')?.getAttribute('style')).toBe(figuras[1].querySelector('img')?.getAttribute('style'));
    expect(figuras[1].getAttribute('data-dummy')).toBeNull();
  });

  it('mantém numeração contínua entre editores e após remover a primeira figura', () => {
    const corpos = [document.createElement('div'), document.createElement('div')];
    corpos[0].innerHTML = criarHtmlFigura('data:image/png;base64,AA==', 'primeira', 'Inicial');
    corpos[1].innerHTML = criarHtmlFigura('data:image/png;base64,BB==', 'segunda', 'Final');
    const editores = corpos.map(corpo => ({ getBody: () => corpo }) as unknown as TinyMceEditorInstance);
    expect(renumerarFigurasNosEditores(editores)).toBe(true);
    expect(corpos[1].querySelector('figcaption')?.textContent).toBe('Figura 02: Final');
    corpos[0].querySelector('figure')?.remove();
    expect(renumerarFigurasNosEditores(editores)).toBe(true);
    expect(corpos[1].querySelector('figcaption')?.textContent).toBe('Figura 01: Final');
  });

  it('restaura apenas legendas ausentes e conserva uma descrição formatada', () => {
    const documento = new DOMParser().parseFromString(
      '<figure class="laudo-figure" data-image-id="a"><img alt="Vista lateral"></figure>'
      + '<figure class="laudo-figure" data-image-id="b"><img alt="Legenda antiga"><figcaption><strong>Figura 02: Legenda do usuário</strong></figcaption></figure>'
      + '<figure class="laudo-figure" data-image-id="c"><img><figcaption>Figura 03</figcaption></figure>',
      'text/html',
    );
    const figuras = Array.from(documento.querySelectorAll('figure'));
    expect(legendaFiguraAusente(figuras[0])).toBe(true);
    expect(restaurarLegendaFigura(figuras[0], 1, 'Vista lateral')).toBe(true);
    expect(restaurarLegendaFigura(figuras[1], 2, 'Legenda antiga')).toBe(false);
    expect(restaurarLegendaFigura(figuras[2], 3, 'Outra descrição')).toBe(false);
    expect(figuras.map(figura => figura.querySelector('figcaption')?.textContent)).toEqual([
      'Figura 01: Vista lateral', 'Figura 02: Legenda do usuário', 'Figura 03',
    ]);
    expect(figuras[1].querySelector('strong')?.textContent).toBe('Figura 02: Legenda do usuário');
  });

  it('renumera sem criar legenda apagada nem perder a formatação da descrição', () => {
    const documento = new DOMParser().parseFromString(
      '<figure class="laudo-figure"><img alt="Texto anterior"></figure>'
      + '<figure class="laudo-figure"><img><figcaption>Figura 09: <em>Detalhe preservado</em></figcaption></figure>',
      'text/html',
    );
    const figuras = Array.from(documento.querySelectorAll('figure'));
    expect(atualizarNumeroFigura(figuras[0], 1)).toBe(false);
    expect(figuras[0].querySelector('img')?.getAttribute('alt')).toBe('Texto anterior');
    expect(atualizarNumeroFigura(figuras[1], 2)).toBe(true);
    expect(figuras[1].querySelector('figcaption')?.textContent).toBe('Figura 02: Detalhe preservado');
    expect(figuras[1].querySelector('em')?.textContent).toBe('Detalhe preservado');
  });
});
