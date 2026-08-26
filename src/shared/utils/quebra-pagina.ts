export const MARCADOR_QUEBRA_PAGINA = '<div data-quebra-pagina="true" style="break-after: page;"></div>';

export function normalizarQuebrasPaginaHtml(html: string): string {
  return html
    .replace(/<!--\s*pagebreak\s*-->/gi, MARCADOR_QUEBRA_PAGINA)
    .replace(/<div\b[^>]*\bdata-quebra-pagina=(?:"true"|'true')[^>]*>\s*<\/div>/gi, MARCADOR_QUEBRA_PAGINA);
}

export function elementoEhQuebraPagina(elemento: Element): boolean {
  return elemento.tagName.toLowerCase() === 'div' && elemento.getAttribute('data-quebra-pagina') === 'true';
}
