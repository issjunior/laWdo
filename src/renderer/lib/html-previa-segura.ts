const SELETOR_ATIVO = 'script, iframe, object, embed, base, link, meta, style, form, input, button';
const IMAGEM_DATA_URI = /^data:image\/(?:jpeg|png|gif|bmp|webp);base64,/i;

export function prepararHtmlPreviaSeguro(html: string): string {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  documento.querySelectorAll(SELETOR_ATIVO).forEach(elemento => elemento.remove());
  for (const elemento of Array.from(documento.body.querySelectorAll<HTMLElement>('*'))) {
    for (const atributo of Array.from(elemento.attributes)) {
      const nome = atributo.name.toLowerCase();
      const valor = atributo.value;
      if (/^on/.test(nome) || ['srcdoc', 'formaction', 'action'].includes(nome)
        || (nome === 'style' && /url\s*\(|expression\s*\(|@import|behavior\s*:/i.test(valor))
        || (['href', 'src', 'xlink:href'].includes(nome) && /^\s*(javascript|vbscript):/i.test(valor))
        || (nome === 'src' && elemento.tagName === 'IMG' && !IMAGEM_DATA_URI.test(valor))) {
        elemento.removeAttribute(atributo.name);
      }
    }
  }
  return documento.body.innerHTML;
}
