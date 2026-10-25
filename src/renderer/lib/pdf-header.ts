import { lerApresentacaoLaudo } from '@shared/configuracoes/apresentacao-laudo';
import { carregarApresentacaoPadrao, montarFechamentoHtml, resolverDadosPerito } from './apresentacao-laudo';
import { buildPlaceholderMapping, resolverPlaceholdersExportacao, type ExportacaoContext } from './exportacao-placeholders';
import type { FalhaPdf } from '@shared/types/pdf.types';
import { normalizarRotuloCabecalho } from '@shared/configuracoes/cabecalhos-padrao';

export class ErroCabecalhoPdf extends Error {
  readonly falhaPdf: FalhaPdf = {
    codigo: 'CABECALHO_INDISPONIVEL',
    etapa: 'carregamento',
    tentarNovamente: true,
    origem: 'cabecalho',
  };
  constructor() {
    super('Não foi possível ler a configuração do cabeçalho do PDF.');
  }
}

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

  let html = stripDataPlaceholderSpans(normalizarRotuloCabecalho(templateHtml));

  html = html.replace(/\{\{pagina\}\}/g, '<span class="pageNumber"></span>');
  html = html.replace(/\{\{totalPaginas\}\}/g, '<span class="totalPages"></span>');

  for (const [key, value] of Object.entries(replacements)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi'), () => value || '');
  }

  const align = detectAlignment(html);

  return { html: `{{ALIGN:${align}}}${html}`, align };
}

export interface PdfHeaderConfig {
  headerTemplate: string;
  cabecalhoPrimeiraPagina: string;
  fechamentoHtml: string;
}

export function montarCabecalhoPrimeiraPagina(html: string): string {
  return html ? `<div class="cabecalho" style="padding-bottom:24px;margin-bottom:0;">${html}</div>` : '';
}

export interface PdfHeaderOptions {
  numeroRepFallback?: string;
  extraReplacements?: Record<string, string>;
  estrito?: boolean;
  apresentacaoJson?: unknown;
  usarCopiaLaudo?: boolean;
  contexto?: ExportacaoContext;
}

/**
 * Loads header configurations from DB and builds the complete PDF header config.
 * Centralizes the DB loading + template building logic that was duplicated across pages.
 */
export async function buildPdfHeaderConfig(opts: PdfHeaderOptions = {}): Promise<PdfHeaderConfig> {
  try {
    const apresentacao = opts.usarCopiaLaudo ? lerApresentacaoLaudo(opts.apresentacaoJson) : await carregarApresentacaoPadrao();
    const contexto: ExportacaoContext = opts.contexto ?? { repData: { numero: opts.numeroRepFallback ?? '' } };
    const replacements = { ...buildPlaceholderMapping(contexto), ...opts.extraReplacements, ...apresentacao.perito };
    if (opts.numeroRepFallback) replacements.numero_rep = opts.numeroRepFallback;
    const escapar = (valor: string) => valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const primeiraPagina = apresentacao.cabecalho.primeiraPaginaHabilitada ? resolverDadosPerito(apresentacao.cabecalho.primeiraPagina, apresentacao.perito) : '';
    const todasPaginas = apresentacao.cabecalho.todasPaginasHabilitadas ? resolverDadosPerito(apresentacao.cabecalho.todasPaginas, apresentacao.perito) : '';
    return {
      headerTemplate: buildHeaderTemplate(todasPaginas, Object.fromEntries(Object.entries(replacements).map(([chave, valor]) => [chave, escapar(valor)]))).html,
      cabecalhoPrimeiraPagina: resolverPlaceholdersExportacao(primeiraPagina, contexto),
      fechamentoHtml: resolverPlaceholdersExportacao(montarFechamentoHtml(apresentacao.fechamento, apresentacao.perito), contexto),
    };
  } catch (erro: unknown) {
    if (opts.estrito) throw new ErroCabecalhoPdf();
    throw erro;
  }
}
