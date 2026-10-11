import { describe, expect, it } from 'vitest';
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import { localizarFiguraPorIndice, reindexarFiguras, renumerarFigurasNosEditores } from '../../renderer/lib/figuras';
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
});
