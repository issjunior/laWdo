import { DomUtils, parseDocument } from 'htmlparser2';

export const ESTILOS_SECOES_PDF = `
  h2 { margin-top: 14px; margin-bottom: 6px; }
  h3 { margin-top: 10px; margin-bottom: 5px; }
  h2, h3 { break-after: avoid-page; page-break-after: avoid; }
  .laudo-figure { break-inside: avoid-page; page-break-inside: avoid; }
`;

export function removerEspacadoresEntreSecoes(html: string): string {
  const documento = parseDocument(html);
  const titulos = DomUtils.findAll(no => no.name === 'h2' || no.name === 'h3', documento.children);
  for (const titulo of titulos) {
    let anterior = titulo.prev;
    while (anterior && anterior.type === 'text' && !DomUtils.textContent(anterior).trim()) anterior = anterior.prev;
    while (anterior?.type === 'tag' && anterior.name === 'p'
      && !DomUtils.textContent(anterior).replace(/\u00a0/g, ' ').trim()
      && !anterior.attribs.style && !anterior.attribs['data-quebra-pagina']) {
      const previo = anterior.prev;
      DomUtils.removeElement(anterior);
      anterior = previo;
      while (anterior && anterior.type === 'text' && !DomUtils.textContent(anterior).trim()) anterior = anterior.prev;
    }
  }
  return DomUtils.getOuterHTML(documento);
}
