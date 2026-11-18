import { obterAjusteVisualParFigura, obterAlturaParFigura } from './documento';
import type { ImagemLaudo } from './tipos';

/** Extrai figuras do HTML de um editor (modo multi ou single) */
export const extrairFigurasDoHtml = (html: string): ImagemLaudo[] => {
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return extrairFigurasDaRaiz(doc);
};

export const extrairFigurasDaRaiz = (raiz: ParentNode): ImagemLaudo[] => {
  const figures = raiz.querySelectorAll('.laudo-figure');
  return Array.from(figures)
    .map((fig, idx) => {
      const id = fig.getAttribute('data-image-id') || '';
      const dummy = fig.getAttribute('data-dummy') === 'true';
      const img = fig.querySelector('img');
      const figcaption = fig.querySelector('figcaption');
      return {
        id,
        ocorrenciaId: fig.getAttribute('data-figure-id') || undefined,
        url: img?.getAttribute('src') || '',
        thumbnailUrl: img?.getAttribute('src') || '',
        legenda: figcaption?.textContent?.replace(/^Fig(?:ura|\.)\s*(?:\d+|XX)[:\s]*\s*/i, '').trim() || '',
        numero_figura: idx + 1,
        sequencia: idx + 1,
        created_at: '',
        dummy,
        imagemOrigemId: fig.getAttribute('data-image-original-id') || undefined,
        alturaParPercentual: obterAlturaParFigura(fig),
        ajusteVisualPar: obterAjusteVisualParFigura(fig),
      };
    })
    .filter(f => f.id && f.url);
};

