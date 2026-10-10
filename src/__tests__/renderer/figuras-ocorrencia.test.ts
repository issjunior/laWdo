import { describe, expect, it } from 'vitest';
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import { localizarFiguraPorIndice } from '../../renderer/lib/figuras';

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
});
