export function ocultarTitulosSecoesNaSaida(html: string): string {
  if (!html.includes('data-ocultar-titulo')) return html;
  const documento = new DOMParser().parseFromString(html, 'text/html');
  documento.body.querySelectorAll('h2[data-ocultar-titulo="true"], h3[data-ocultar-titulo="true"]').forEach(titulo => titulo.remove());
  return documento.body.innerHTML;
}
