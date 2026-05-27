const DATA_PLACEHOLDER_SPAN_RE = /<span\b[^>]*\bdata-placeholder="\{\{([^}]+)\}\}"[^>]*>[\s\S]*?<\/span>/gi;

function stripDataPlaceholderSpans(html: string): string {
  return html.replace(DATA_PLACEHOLDER_SPAN_RE, '{{$1}}');
}

/**
 * Converts user-authored HTML into Chromium's headerTemplate format.
 * - Strips TinyMCE's data-placeholder spans, extracting {{chave}} from attributes
 * - Replaces {{pagina}} / {{totalPaginas}} with Chromium's page number spans
 * - Replaces other placeholders using the provided replacements map
 */
export function buildHeaderTemplate(templateHtml: string, replacements: Record<string, string> = {}): string {
  if (!templateHtml) return '';

  const debugTag = '[pdf-header:buildHeaderTemplate]';

  let html = stripDataPlaceholderSpans(templateHtml);

  html = html.replace(/\{\{pagina\}\}/g, '<span class="pageNumber"></span>');
  html = html.replace(/\{\{totalPaginas\}\}/g, '<span class="totalPages"></span>');

  for (const [key, value] of Object.entries(replacements)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi'), value || '');
  }

  if (html !== templateHtml) {
    console.debug(`${debugTag} transformed (${templateHtml.length} → ${html.length} chars)`);
  }

  return html;
}

export interface PdfHeaderConfig {
  headerTemplate: string;
  cabecalhoPrimeiraPagina: string;
}

export interface PdfHeaderOptions {
  numeroRepFallback?: string;
  extraReplacements?: Record<string, string>;
}

/**
 * Loads header configurations from DB and builds the complete PDF header config.
 * Centralizes the DB loading + template building logic that was duplicated across pages.
 */
export async function buildPdfHeaderConfig(opts: PdfHeaderOptions = {}): Promise<PdfHeaderConfig> {
  const debugTag = '[pdf-header:buildPdfHeaderConfig]';

  const [headerLaudoResult, headerPaginasResult] = await Promise.all([
    window.ipcAPI.configuracao.obter('cabecalho_laudo'),
    window.ipcAPI.configuracao.obter('cabecalho_paginas'),
  ]);

  const cabecalhoPrimeiraPagina = (headerLaudoResult.success && headerLaudoResult.data) ? headerLaudoResult.data : '';
  const cabecalhoPaginasHtml = (headerPaginasResult.success && headerPaginasResult.data) ? headerPaginasResult.data : '';

  console.debug(`${debugTag} cabecalho_laudo: ${cabecalhoPrimeiraPagina ? `${cabecalhoPrimeiraPagina.length} chars` : 'vazio'}`);
  console.debug(`${debugTag} cabecalho_paginas: ${cabecalhoPaginasHtml ? `${cabecalhoPaginasHtml.length} chars` : 'vazio'}`);

  const replacements: Record<string, string> = {};
  if (opts.numeroRepFallback) {
    replacements.numero_rep = opts.numeroRepFallback;
  }
  if (opts.extraReplacements) {
    Object.assign(replacements, opts.extraReplacements);
  }

  const headerTemplate = cabecalhoPaginasHtml
    ? buildHeaderTemplate(cabecalhoPaginasHtml, replacements)
    : '';

  console.debug(`${debugTag} headerTemplate: ${headerTemplate ? `${headerTemplate.length} chars` : 'vazio'} | cabecalhoPrimeiraPagina: ${cabecalhoPrimeiraPagina ? `${cabecalhoPrimeiraPagina.length} chars` : 'vazio'}`);

  return { headerTemplate, cabecalhoPrimeiraPagina };
}
