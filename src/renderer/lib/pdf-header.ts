const DATA_PLACEHOLDER_SPAN_RE = /<span\b[^>]*\bdata-placeholder="\{\{([^}]+)\}\}"[^>]*>[\s\S]*?<\/span>/gi;

function stripDataPlaceholderSpans(html: string): string {
  return html.replace(DATA_PLACEHOLDER_SPAN_RE, '{{$1}}');
}

function detectAlignment(html: string): string {
  const match = html.match(/text-align:\s*(right|center|left)/i);
  if (!match || match[1].toLowerCase() === 'left') return 'flex-start';
  if (match[1].toLowerCase() === 'center') return 'center';
  return 'flex-end';
}

/**
 * Converts user-authored HTML into Chromium's headerTemplate format.
 * - Strips TinyMCE's data-placeholder spans, extracting {{chave}} from attributes
 * - Replaces {{pagina}} / {{totalPaginas}} with Chromium's page number spans
 * - Replaces other placeholders using the provided replacements map
 * - Detects text-align from TinyMCE and returns appropriate flex alignment
 */
export function buildHeaderTemplate(templateHtml: string, replacements: Record<string, string> = {}): { html: string; align: string } {
  if (!templateHtml) return { html: '', align: 'flex-start' };

  let html = stripDataPlaceholderSpans(templateHtml);

  html = html.replace(/\{\{pagina\}\}/g, '<span class="pageNumber"></span>');
  html = html.replace(/\{\{totalPaginas\}\}/g, '<span class="totalPages"></span>');

  for (const [key, value] of Object.entries(replacements)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi'), value || '');
  }

  const align = detectAlignment(html);

  html = html.replace(/;\s*text-align:\s*\w+/gi, '');
  html = html.replace(/text-align:\s*\w+;\s*/gi, '');
  html = html.replace(/text-align:\s*\w+/gi, '');

  return { html: `{{ALIGN:${align}}}${html}`, align };
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

  const result = cabecalhoPaginasHtml
    ? buildHeaderTemplate(cabecalhoPaginasHtml, replacements)
    : { html: '', align: 'flex-start' };

  console.debug(`${debugTag} headerTemplate: ${result.html ? `${result.html.length} chars` : 'vazio'} | align: ${result.align} | cabecalhoPrimeiraPagina: ${cabecalhoPrimeiraPagina ? `${cabecalhoPrimeiraPagina.length} chars` : 'vazio'}`);

  return { headerTemplate: result.html, cabecalhoPrimeiraPagina };
}
