import { DomUtils, parseDocument } from 'htmlparser2';

const TAGS_ATIVOS = new Set(['script', 'iframe', 'object', 'embed', 'base', 'link', 'meta', 'style', 'form', 'input', 'button']);
const IMAGEM_DATA_URI = /^data:image\/(?:jpeg|png|gif|bmp|webp);base64,/i;
const IMAGEM_SVG_DATA_URI = /^data:image\/svg\+xml(?:;base64)?,/i;

export function validarHtmlSeguro(html: string, contexto: string): void {
  if (html.length > 12 * 1024 * 1024) throw new Error(`${contexto} excede o limite de 12 MB.`);
  const documento = parseDocument(html);
  const elementos = DomUtils.findAll(() => true, documento.children);
  if (elementos.length > 500_000) throw new Error(`${contexto} excede o limite de complexidade.`);

  const imagemSvgDeFiguraDummy = (elemento: (typeof elementos)[number], valor: string): boolean => {
    if (!IMAGEM_SVG_DATA_URI.test(valor)) return false;

    let ancestral = elemento.parent;
    while (ancestral) {
      if ('attribs' in ancestral && ancestral.attribs['data-dummy'] === 'true') return true;
      ancestral = ancestral.parent;
    }
    return false;
  };

  for (const elemento of elementos) {
    if (TAGS_ATIVOS.has(elemento.name)) throw new Error(`${contexto} contém conteúdo ativo não permitido.`);
    for (const [chave, valor] of Object.entries(elemento.attribs)) {
      if (/^on/i.test(chave) || ['srcdoc', 'formaction', 'action'].includes(chave)
        || (chave === 'style' && /url\s*\(|expression\s*\(|@import|behavior\s*:/i.test(valor))
        || (['href', 'src', 'xlink:href'].includes(chave) && /^\s*(javascript|vbscript):/i.test(valor))) {
        throw new Error(`${contexto} contém atributo ativo não permitido.`);
      }
      if (chave === 'src' && elemento.name === 'img' && !IMAGEM_DATA_URI.test(valor)
        && !imagemSvgDeFiguraDummy(elemento, valor)) {
        throw new Error(`${contexto} contém imagem externa não permitida.`);
      }
    }
  }
}
