import sanitizeHtml from 'sanitize-html';
import { URL_FIGURA_DUMMY } from '../../../shared/figura/html.js';

export function sanitizarHtmlImportacao(html: string, revisao = true): string {
  if (html.length > 12 * 1024 * 1024) throw new Error('Conteúdo da importação excede o limite de 12 MB');
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col', 'blockquote', 'span', 'a', 'figure', 'img', 'figcaption'],
    allowedAttributes: {
      '*': ['class', 'style', ...(revisao ? ['data-importacao-elemento', 'data-importacao-pagina'] : [])],
      td: ['rowspan', 'colspan'],
      th: ['rowspan', 'colspan', 'scope'],
      figure: ['data-image-id', 'data-dummy'],
      span: ['data-placeholder', 'data-key', 'data-reservado', 'contenteditable'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedClasses: { '*': ['laudo-figure', 'campo-reservado', 'placeholder', 'mceNonEditable'] },
    allowedStyles: { '*': {
      'text-align': [/^(left|right|center|justify)$/], 'font-weight': [/^(bold|normal|[1-9]00)$/],
      'font-style': [/^(italic|normal)$/], 'text-decoration': [/^(underline|line-through)$/],
      'font-size': [/^\d{1,2}(px|pt)$/], width: [/^(\d{1,3}%|\d{1,4}px)$/], 'max-width': [/^100%$/],
      height: [/^(auto|\d{1,4}px)$/], margin: [/^12px auto$/], 'margin-top': [/^4px$/],
      color: [/^#[0-9a-f]{3,6}$/i], border: [/^1px solid #444$/], 'border-radius': [/^4px$/], padding: [/^4px$/], cursor: [/^pointer$/],
    } },
    allowedSchemes: ['data'], allowProtocolRelative: false, nestingLimit: 80,
    transformTags: {
      img: (_tag, atributos) => ({ tagName: 'img', attribs: { ...atributos, src: URL_FIGURA_DUMMY, alt: 'Figura XX' } }),
      td: (_tag, atributos) => ({ tagName: 'td', attribs: limitarMesclagem(atributos) }),
      th: (_tag, atributos) => ({ tagName: 'th', attribs: limitarMesclagem(atributos) }),
    },
  });
}

function limitarMesclagem(atributos: Record<string, string>): Record<string, string> {
  const resultado = { ...atributos };
  for (const campo of ['rowspan', 'colspan']) {
    if (resultado[campo] && (!/^\d+$/.test(resultado[campo]) || Number(resultado[campo]) < 1 || Number(resultado[campo]) > 500)) delete resultado[campo];
  }
  return resultado;
}
