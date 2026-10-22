import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import { observarEstruturaFiguras } from '@/lib/figuras';
import { normalizarConteudoComparavel } from '@/lib/conteudo-comparavel-laudo';

afterEach(() => vi.restoreAllMocks());

describe('desempenho da edição de laudos', () => {
  it('não renumera ao digitar texto comum e observa inserção, legenda e remoção de figuras', async () => {
    const raiz = document.createElement('div');
    raiz.innerHTML = '<p>Texto</p>';
    const aoAlterar = vi.fn();
    let aoRemover = () => {};
    const editor = {
      getBody: () => raiz,
      on: (_evento: string, executar: () => void) => { aoRemover = executar; },
    } as unknown as TinyMceEditorInstance;
    observarEstruturaFiguras(editor, aoAlterar);
    try {
      raiz.querySelector('p')!.firstChild!.textContent = 'Digitação';
      raiz.appendChild(document.createElement('p'));
      await Promise.resolve();
      expect(aoAlterar).not.toHaveBeenCalled();

      const figura = document.createElement('figure');
      figura.className = 'laudo-figure';
      figura.innerHTML = '<img src="foto.png"><figcaption>Figura 01: Vista</figcaption>';
      raiz.appendChild(figura);
      await Promise.resolve();
      expect(aoAlterar).toHaveBeenCalledTimes(1);

      figura.querySelector('figcaption')!.firstChild!.textContent = 'Figura 01: Outra vista';
      await Promise.resolve();
      expect(aoAlterar).toHaveBeenCalledTimes(2);

      figura.querySelector('img')!.setAttribute('src', 'outra.png');
      await Promise.resolve();
      expect(aoAlterar).toHaveBeenCalledTimes(3);

      figura.remove();
      await Promise.resolve();
      expect(aoAlterar).toHaveBeenCalledTimes(4);

      aoRemover();
      raiz.appendChild(figura);
      await Promise.resolve();
      expect(aoAlterar).toHaveBeenCalledTimes(4);
    } finally {
      aoRemover();
    }
  });

  it('normaliza um laudo com imagem de 4 MB usando uma única análise do HTML', () => {
    const analisar = vi.spyOn(DOMParser.prototype, 'parseFromString');
    const imagem = 'A'.repeat(4_000_000);
    const html = '<p><strong>Texto preservado</strong></p>'
      + '<span data-placeholder="{{nome}}" data-placeholder-apresentacao="dados">Nome exibido</span>'
      + '<div data-placeholder-preview="true">Prévia descartada</div>'
      + '<table><tbody><tr><td>TABELA 9</td></tr></tbody></table>'
      + `<img src="data:image/png;base64,${imagem}">`;
    const resultado = normalizarConteudoComparavel(html);
    expect(analisar).toHaveBeenCalledTimes(1);
    expect(resultado).toContain('<strong>Texto preservado</strong>');
    expect(resultado).toContain('{{nome}}');
    expect(resultado).not.toContain('Nome exibido');
    expect(resultado).not.toContain('Prévia descartada');
    expect(resultado).toContain('TABELA 1');
    expect(resultado).toContain(`src="data:image/png;base64,${imagem}"`);
  });
});
