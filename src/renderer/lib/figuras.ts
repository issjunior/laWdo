/**
 * Funções utilitárias para manipulação de figuras e legendas no laudo
 */
import type { Editor as TinyMceEditorInstance } from 'tinymce';

export function localizarFiguraPorIndice(editores: TinyMceEditorInstance[], indice: number): { editor: TinyMceEditorInstance; figura: HTMLElement } | null {
  if (!Number.isInteger(indice) || indice < 0) return null;
  const figuras = editores.flatMap(editor => Array.from(editor.getBody()?.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]') || [])
    .map(figura => ({ editor, figura })));
  return figuras[indice] || null;
}

/**
 * Reindexa todas as figuras no HTML do laudo, garantindo que a numeração (Figura 01, 02...)
 * siga a ordem física de aparição no documento.
 */
export function reindexarFiguras(html: string): string {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const figures = doc.querySelectorAll('.laudo-figure');

  figures.forEach((figure, index) => {
    const num = index + 1;
    const numFormatado = num.toString().padStart(2, '0');
    const figcaption = figure.querySelector('figcaption');
    const img = figure.querySelector('img');

    if (figcaption) {
      // Preserva o conteúdo da legenda, atualizando apenas o prefixo "Figura XX: "
      const legendaAtual = figcaption.textContent || '';
      const textoLimpo = legendaAtual.replace(/^Fig(?:ura|\.)\s*(?:\d+|XX)[:\s]*\s*/i, '');
      figcaption.textContent = textoLimpo ? `Figura ${numFormatado}: ${textoLimpo}` : `Figura ${numFormatado}`;

      // Sincroniza o alt da imagem se existir
      if (img) {
        img.alt = figcaption.textContent;
      }
    }
  });

  return doc.body.innerHTML;
}

