import { describe, expect, it } from 'vitest';
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import { atualizarNumeroFigura, legendaFiguraAusente, localizarFiguraPorIndice, reindexarFiguras, renumerarFigurasNosEditores, restaurarLegendaFigura } from '../../renderer/lib/figuras';
import { criarHtmlFigura } from '../../renderer/lib/figura-html';

describe('ocorrências de figuras', () => {
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
