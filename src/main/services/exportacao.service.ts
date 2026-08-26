import { app, dialog, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import type { DocumentoExportacao, MargensExportacao } from '../../shared/types/exportacao.types.js';
import { normalizarQuebrasPaginaHtml } from '../../shared/utils/quebra-pagina.js';
import { obterNomeArquivoLaudo } from '../../shared/utils/nomes-documentos-rep.js';
import type {
  FileChild,
  IParagraphOptions,
  ISectionOptions,
  ParagraphChild,
} from 'docx';
import { getLogger } from '../utils/logger.js';

const log = getLogger('exportacao');

let disponibilidadeLibreOfficeEmCache: boolean | null = null;
let verificacaoLibreOfficeEmAndamento: Promise<boolean> | null = null;

const CM_TO_INCHES = 1 / 2.54;

interface ExportacaoCabecalho {
  logoBase64?: string;
  texto?: string;
  alinhamento?: string;
}

interface ImagemExportacao {
  id: string;
  base64: string;
  formato: string;
  legenda: string;
  numero: number;
}

interface ElementoParagrafoExportacao {
  tipo: 'paragrafo';
  html: string;
  alinhamento?: string;
  nivelTitulo?: number;
}

interface ElementoTabelaExportacao {
  tipo: 'tabela';
  linhas: string[][];
  cabecalho?: boolean;
}

interface ElementoListaExportacao {
  tipo: 'lista';
  items: string[];
  ordenada: boolean;
  nivel: number;
}

interface ElementoFiguraExportacao {
  tipo: 'figura';
  imagemId: string;
  legenda: string;
  numero: number;
}

interface ElementoQuebraExportacao {
  tipo: 'quebra';
}

type ElementoExportacao =
  | ElementoParagrafoExportacao
  | ElementoTabelaExportacao
  | ElementoListaExportacao
  | ElementoFiguraExportacao
  | ElementoQuebraExportacao;

interface SecaoExportacao {
  titulo: string;
  elementos: ElementoExportacao[];
}

interface EstruturaExportacaoLaudo {
  fontFamily: string;
  fontSize: string;
  secoes: SecaoExportacao[];
  imagens: ImagemExportacao[];
}

export interface ExportarParams {
  laudoId: string;
  formato: 'pdf' | 'docx' | 'odt';
  html: string;
  estrutura?: DocumentoExportacao;
  cabecalho?: ExportacaoCabecalho;
  margens?: MargensExportacao;
  nomeArquivo?: string;
}

type TipoImagemDocx = 'jpg' | 'png' | 'gif' | 'bmp';

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function htmlDosTrechos(trechos: import('../../shared/types/exportacao.types.js').TrechoExportacao[]): string {
  return trechos.map(t => {
    let html = escaparHtml(t.texto).replace(/\u00a0/g, '&nbsp;');
    if (t.quebraLinha) html += '<br>';
    if (t.estilo?.negrito) html = `<strong>${html}</strong>`;
    if (t.estilo?.italico) html = `<em>${html}</em>`;
    if (t.estilo?.sublinhado) html = `<u>${html}</u>`;
    if (t.estilo?.tachado) html = `<s>${html}</s>`;
    return html;
  }).join('');
}

export function converterDocumentoLegado(documento: DocumentoExportacao): EstruturaExportacaoLaudo {
  const imagens: ImagemExportacao[] = [];
  const secoes: SecaoExportacao[] = documento.secoes.map(secao => ({
    titulo: secao.titulo ? secao.titulo.trechos.map(t => t.texto).join('') : '',
    elementos: secao.blocos.flatMap<ElementoExportacao>(elemento => {
      if (elemento.tipo === 'paragrafo') return [{ tipo: 'paragrafo' as const, html: htmlDosTrechos(elemento.trechos), alinhamento: elemento.alinhamento, nivelTitulo: elemento.nivelTitulo }];
      if (elemento.tipo === 'lista') return [{ tipo: 'lista' as const, items: elemento.itens.map(item => htmlDosTrechos(item.trechos)), ordenada: elemento.ordenada, nivel: elemento.nivel + 1 }];
      if (elemento.tipo === 'linha-horizontal') return [{ tipo: 'quebra' as const }];
      if (elemento.tipo === 'quebra-pagina') return [{ tipo: 'quebra' as const }];
      if (elemento.tipo === 'tabela') return [{ tipo: 'tabela' as const, linhas: elemento.linhas.map(linha => linha.map(celula => htmlDosTrechos(celula.paragrafos.flatMap(p => p.trechos)))), cabecalho: false }];
      const id = `figura-${imagens.length}`;
      imagens.push({ id, base64: elemento.base64, formato: elemento.formato, legenda: elemento.legenda?.trechos.map(t => t.texto).join('') || '', numero: imagens.length + 1 });
      return [{ tipo: 'figura' as const, imagemId: id, legenda: imagens.at(-1)?.legenda || '', numero: imagens.length }];
    }),
  }));
  return { fontFamily: documento.fontePadrao, fontSize: `${documento.tamanhoPadraoPt}pt`, secoes, imagens };
}

function documentoValido(valor: unknown): valor is DocumentoExportacao {
  if (!valor || typeof valor !== 'object') return false;
  const d = valor as Partial<DocumentoExportacao>;
  if (d.versao !== 1 || typeof d.fontePadrao !== 'string' || !Number.isFinite(d.tamanhoPadraoPt) || !Array.isArray(d.secoes)) return false;
  return d.secoes.every(secao => secao && typeof secao === 'object' && Array.isArray(secao.blocos) && secao.blocos.every(bloco => {
    if (!bloco || typeof bloco !== 'object' || !('tipo' in bloco)) return false;
    if (bloco.tipo === 'paragrafo') return Array.isArray(bloco.trechos) && bloco.trechos.every(t => t && typeof t.texto === 'string');
    if (bloco.tipo === 'lista') return typeof bloco.ordenada === 'boolean' && Number.isInteger(bloco.nivel) && Array.isArray(bloco.itens) && bloco.itens.every(item => Array.isArray(item.trechos));
    if (bloco.tipo === 'tabela') return Array.isArray(bloco.linhas) && bloco.linhas.every(linha => Array.isArray(linha) && linha.every(celula => Array.isArray(celula.paragrafos)));
    if (bloco.tipo === 'figura') return typeof bloco.base64 === 'string' && typeof bloco.formato === 'string';
    if (bloco.tipo === 'quebra-pagina') return true;
    return bloco.tipo === 'linha-horizontal';
  }));
}

async function extrairNumeroRep(laudoId: string): Promise<string> {
  try {
    const { laudoService } = await import('./laudo.service.js');
    const laudo = await laudoService.findById(laudoId);
    if (laudo?.rep_id) {
      const { repService } = await import('./rep.service.js');
      const rep = await repService.findById(laudo.rep_id);
      if (rep) return rep.numero || laudoId;
    }
  } catch { /* fallback */ }
  return laudoId;
}

async function gerarPDF(html: string, margens?: ExportarParams['margens'], headerTemplate?: string): Promise<Buffer> {
  let win: BrowserWindow | null = null;
  let tmpPath: string | null = null;

  try {
    const hasMargins = margens && (margens.top > 0 || margens.right > 0 || margens.bottom > 0 || margens.left > 0);
    const bodyPadding = hasMargins ? '0 0 12px 0' : '50px 60px';
    const leftPad = hasMargins ? `${margens!.left}cm` : '60px';
    const rightPad = hasMargins ? `${margens!.right}cm` : '60px';

    const docHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px; line-height: 1.7; color: #1a1a1a;
    padding: ${bodyPadding}; max-width: 210mm; margin: 0 auto;
  }
  h1 { font-size: 20px; margin-bottom: 12px; }
  h2 { font-size: 16px; margin-top: 28px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 14px; margin-top: 20px; margin-bottom: 8px; }
  p { margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100% !important; max-width: 100% !important; margin: 12px 0; }
  table th, table td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  table th { background: #f5f5f5; font-weight: 600; }
  ul, ol { margin: 8px 0; padding-left: 24px; }
  li { margin-bottom: 4px; }
  img { max-width: 100%; height: auto; display: block; margin: 10px auto; }
  .laudo-figure { text-align: center; margin: 12px auto; page-break-inside: avoid; }
  figcaption { font-size: 12px; color: #444; font-weight: bold; margin-top: 4px; }
  [data-quebra-pagina="true"] { break-after: page; page-break-after: always; height: 0; }
</style>
</head>
<body>${normalizarQuebrasPaginaHtml(html)}</body>
</html>`;

    win = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });

    tmpPath = path.join(app.getPath('temp'), `export-pdf-${Date.now()}.html`);
    fs.writeFileSync(tmpPath, docHtml, 'utf-8');
    await win.loadFile(tmpPath);
    await new Promise(resolve => setTimeout(resolve, 800));

    const pdfMargins = margens
      ? { top: margens.top * CM_TO_INCHES, right: margens.right * CM_TO_INCHES, bottom: margens.bottom * CM_TO_INCHES, left: margens.left * CM_TO_INCHES }
      : { top: 0, bottom: 0, left: 0, right: 0 };

    const printOptions: Electron.PrintToPDFOptions = {
      printBackground: true,
      preferCSSPageSize: true,
      margins: pdfMargins,
    };

    if (headerTemplate) {
      const alignMatch = headerTemplate.match(/^\{\{ALIGN:([^}]+)\}\}/);
      const align = alignMatch ? alignMatch[1] : 'flex-start';
      const cleanTemplate = headerTemplate.replace(/^\{\{ALIGN:[^}]+\}\}/, '');
      const textAlign = align === 'flex-end' ? 'right' : align === 'center' ? 'center' : 'left';

      printOptions.displayHeaderFooter = true;
      printOptions.headerTemplate = `<style>
  .header-container { display: flex; flex-direction: column; align-items: stretch; width: 100%;
    text-align: ${textAlign}; padding-left: ${leftPad}; padding-right: ${rightPad};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px; line-height: 1.1; color: #1a1a1a; }
  .header-container p, .header-container div { margin: 0; padding: 0; line-height: 1.1; }
</style><div class="header-container">${cleanTemplate}</div>`;
      printOptions.footerTemplate = '<html><head></head><body></body></html>';
    }

    const buffer = Buffer.from(await win.webContents.printToPDF(printOptions));
    log.debug('PDF exportado com sucesso');
    return buffer;
  } finally {
    if (win) { try { win.close(); } catch { /* ignora */ } }
    if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch { /* ignora */ } }
  }
}

function normalizarTipoImagemDocx(formato: string): TipoImagemDocx | null {
  switch (formato.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'gif':
      return 'gif';
    case 'bmp':
      return 'bmp';
    default:
      return null;
  }
}

function mapearHeadingDocx(
  headingLevel: typeof import('docx').HeadingLevel,
  nivel: number
): (typeof import('docx').HeadingLevel)[keyof typeof import('docx').HeadingLevel] | undefined {
  switch (nivel) {
    case 3:
      return headingLevel.HEADING_3;
    case 4:
      return headingLevel.HEADING_4;
    case 5:
      return headingLevel.HEADING_5;
    case 6:
      return headingLevel.HEADING_6;
    default:
      return undefined;
  }
}

export async function gerarDOCX(
  estrutura: EstruturaExportacaoLaudo,
  cabecalho?: ExportarParams['cabecalho'],
  margens?: ExportarParams['margens']
): Promise<Buffer> {
  const docx = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, ImageRun, Header, UnderlineType, WidthType,
  } = docx;

  const children: FileChild[] = [];
  const imagensMap = new Map<string, { base64: string; formato: string }>();

  if (estrutura.imagens) {
    for (const img of estrutura.imagens) {
      imagensMap.set(img.id, { base64: img.base64, formato: img.formato });
    }
  }

  function parseInlineHtml(html: string): ParagraphChild[] {
    const runs: ParagraphChild[] = [];
    const regex = /<(\/?)(\w+)([^>]*)>/g;
    let lastIndex = 0;
    let currentBold = false;
    let currentItalic = false;
    let currentUnderline = false;
    let currentStrikethrough = false;

    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match.index > lastIndex) {
        const text = html.substring(lastIndex, match.index).replace(/&nbsp;/g, ' ');
        if (text) {
          runs.push(new TextRun({
            text,
            bold: currentBold,
            italics: currentItalic,
            underline: currentUnderline ? { type: UnderlineType.SINGLE } : undefined,
            strike: currentStrikethrough,
          }));
        }
      }
      const tag = match[2].toLowerCase();
      const isClose = match[1] === '/';
      if (tag === 'strong' || tag === 'b') { currentBold = !isClose; }
      else if (tag === 'em' || tag === 'i') { currentItalic = !isClose; }
      else if (tag === 'u') { currentUnderline = !isClose; }
      else if (tag === 's' || tag === 'strike') { currentStrikethrough = !isClose; }
      else if (tag === 'br') { runs.push(new TextRun({ break: 1 })); }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < html.length) {
      const text = html.substring(lastIndex).replace(/&nbsp;/g, ' ');
      if (text) {
        runs.push(new TextRun({ text, bold: currentBold, italics: currentItalic }));
      }
    }

    if (runs.length === 0) {
      const plain = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (plain) runs.push(new TextRun(plain));
    }

    return runs;
  }

  function alinhamentoToAlignmentType(
    alinhamento?: string
  ): (typeof AlignmentType)[keyof typeof AlignmentType] {
    switch (alinhamento) {
      case 'center': return AlignmentType.CENTER;
      case 'right': return AlignmentType.RIGHT;
      case 'justify': return AlignmentType.JUSTIFIED;
      default: return AlignmentType.LEFT;
    }
  }

  if (estrutura.secoes) {
    for (const secao of estrutura.secoes) {
      if (secao.titulo) {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: secao.titulo, bold: true })],
        } satisfies IParagraphOptions));
      }

      if (secao.elementos) {
        for (const el of secao.elementos) {
          switch (el.tipo) {
            case 'paragrafo': {
              const runs = parseInlineHtml(el.html);
              if (runs.length > 0) {
                const heading = typeof el.nivelTitulo === 'number'
                  ? mapearHeadingDocx(HeadingLevel, el.nivelTitulo)
                  : undefined;
                children.push(new Paragraph({
                  ...(heading ? { heading } : {}),
                  alignment: alinhamentoToAlignmentType(el.alinhamento),
                  children: runs,
                } satisfies IParagraphOptions));
              }
              break;
            }

            case 'tabela': {
              const rows = [];
              for (let i = 0; i < el.linhas.length; i++) {
                const row = el.linhas[i];
                const cells = row.map((cell: string) => new TableCell({
                  children: [new Paragraph({ children: parseInlineHtml(cell) })],
                  ...((el.cabecalho && i === 0) ? { shading: { fill: 'f5f5f5' } } : {}),
                }));
                rows.push(new TableRow({ children: cells }));
              }
              if (rows.length > 0) {
                children.push(new Table({
                  rows,
                  width: { size: 100, type: WidthType.PERCENTAGE },
                }));
              }
              break;
            }

            case 'lista': {
              for (let i = 0; i < el.items.length; i++) {
                children.push(new Paragraph({
                  children: parseInlineHtml(el.items[i]),
                  bullet: { level: el.nivel - 1 },
                  ...(el.ordenada ? { numbering: { reference: 'default-numbering', level: el.nivel - 1 } } : {}),
                }));
              }
              break;
            }

            case 'figura': {
              const imgData = imagensMap.get(el.imagemId);
              if (imgData) {
                try {
                  const imgBuffer = Buffer.from(imgData.base64, 'base64');
                  const tipoImagem = normalizarTipoImagemDocx(imgData.formato);
                  if (!tipoImagem) {
                    break;
                  }
                  children.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({
                      type: tipoImagem,
                      data: imgBuffer,
                      transformation: { width: 450, height: 300 },
                    })],
                  } satisfies IParagraphOptions));
                } catch { /* ignora imagem inválida */ }
              }
              if (el.legenda) {
                const prefixo = el.numero ? `Figura ${el.numero}` : 'Figura';
                const texto = el.legenda ? `${prefixo}: ${el.legenda}` : prefixo;
                children.push(new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: texto, italics: true, size: 20 })],
                }));
              }
              break;
            }

            case 'quebra': {
              children.push(new Paragraph({ children: [] }));
              break;
            }
          }
        }
      }
    }
  }

  const propriedadesSecao = margens ? {
    page: {
      margin: {
        top: Math.round(margens.top * 567),
        right: Math.round(margens.right * 567),
        bottom: Math.round(margens.bottom * 567),
        left: Math.round(margens.left * 567),
      },
    },
  } : undefined;

  let headers: ISectionOptions['headers'] | undefined;
  if (cabecalho?.texto || cabecalho?.logoBase64) {
    const headerChildren: Array<InstanceType<typeof Paragraph>> = [];

    if (cabecalho.logoBase64) {
      try {
        const logoBuffer = Buffer.from(cabecalho.logoBase64, 'base64');
        headerChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({
            type: 'png',
            data: logoBuffer,
            transformation: { width: 120, height: 60 },
          })],
        } satisfies IParagraphOptions));
      } catch { /* ignora logo inválido */ }
    }

    if (cabecalho.texto) {
      const align = cabecalho.alinhamento === 'center' ? AlignmentType.CENTER
        : cabecalho.alinhamento === 'right' ? AlignmentType.RIGHT
        : AlignmentType.LEFT;
      headerChildren.push(new Paragraph({
        alignment: align,
        children: [new TextRun({ text: cabecalho.texto, size: 18, color: '666666' })],
      } satisfies IParagraphOptions));
    }

    if (headerChildren.length > 0) {
      headers = { first: new Header({ children: headerChildren }) };
    }
  }

  const sectionOpts: ISectionOptions = {
    children,
    ...(propriedadesSecao || headers ? { properties: { ...propriedadesSecao, ...(headers ? { titlePage: true } : {}) } } : {}),
    ...(headers ? { headers } : {}),
  };

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: estrutura.fontFamily || 'Calibri',
            size: estrutura.fontSize ? Math.round(parseFloat(estrutura.fontSize) * 2) : 22,
          },
        },
      },
    },
    sections: [sectionOpts],
  });

  return await Packer.toBuffer(doc);
}

function obterCandidatosLibreOffice(): string[] {
  const candidatosPorPlataforma: Record<NodeJS.Platform, string[]> = {
    win32: [
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'LIBREO~1/program/soffice.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'LibreOffice/program/soffice.exe'),
      path.join(process.env.PROGRAMFILES_X86 || '', 'LibreOffice/program/soffice.exe'),
      path.join(process.env.PROGRAMFILES || '', 'LibreOffice/program/soffice.exe'),
      process.env.LIBRE_OFFICE_EXE || '',
      'C:/Program Files/LibreOffice/program/soffice.exe',
    ],
    darwin: ['/Applications/LibreOffice.app/Contents/MacOS/soffice'],
    linux: [
      '/usr/bin/libreoffice',
      '/usr/bin/soffice',
      '/snap/bin/libreoffice',
      '/opt/libreoffice/program/soffice',
      '/opt/libreoffice7.6/program/soffice',
    ],
    aix: [],
    android: [],
    freebsd: [],
    haiku: [],
    openbsd: [],
    sunos: [],
    cygwin: [],
    netbsd: [],
  };

  return [...new Set((candidatosPorPlataforma[process.platform] || [])
    .filter(Boolean)
    .map(caminho => path.normalize(caminho)))];
}

async function localizarExecutavelLibreOffice(): Promise<string | null> {
  for (const caminho of obterCandidatosLibreOffice()) {
    try {
      const estatisticas = await fs.promises.stat(caminho);
      if (estatisticas.isFile()) return caminho;
    } catch {
      // Tenta o próximo caminho conhecido.
    }
  }
  return null;
}

async function verificarDisponibilidadeLibreOffice(): Promise<boolean> {
  const executavel = await localizarExecutavelLibreOffice();
  return executavel !== null;
}

export async function gerarDOCXCanonico(documento: DocumentoExportacao, cabecalho?: ExportacaoCabecalho, margens?: MargensExportacao): Promise<Buffer> {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell, ImageRun, Header, PageBreak, AlignmentType, UnderlineType, HeadingLevel, WidthType, BorderStyle } = d;
  const alinhar = (v?: string) => v === 'center' ? AlignmentType.CENTER : v === 'right' ? AlignmentType.RIGHT : v === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;
  const runs = (trechos: import('../../shared/types/exportacao.types.js').TrechoExportacao[]): ParagraphChild[] => trechos.flatMap<ParagraphChild>(t => {
    const e = t.estilo || {}; const opcoes = { text: t.texto, break: t.quebraLinha ? 1 : undefined, bold: e.negrito, italics: e.italico, strike: e.tachado, underline: e.sublinhado ? { type: UnderlineType.SINGLE } : undefined, superScript: e.sobrescrito, subScript: e.subscrito, font: e.fonte, size: e.tamanhoPt ? Math.round(e.tamanhoPt * 2) : undefined, color: e.cor, highlight: e.realce ? 'yellow' as const : undefined };
    return e.link ? [new ExternalHyperlink({ link: e.link, children: [new TextRun({ ...opcoes, style: 'Hyperlink' })] })] : [new TextRun(opcoes)];
  });
  const para = (p: import('../../shared/types/exportacao.types.js').ParagrafoExportacao, extra: object = {}) => new Paragraph({
    children: runs(p.trechos), alignment: alinhar(p.alinhamento), heading: p.nivelTitulo ? [undefined, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][p.nivelTitulo] : undefined,
    indent: { left: p.recuoEsquerdoPt ? Math.round(p.recuoEsquerdoPt * 20) : undefined, right: p.recuoDireitoPt ? Math.round(p.recuoDireitoPt * 20) : undefined, firstLine: p.recuoPrimeiraLinhaPt ? Math.round(p.recuoPrimeiraLinhaPt * 20) : undefined }, spacing: { before: p.espacamentoAntesPt ? Math.round(p.espacamentoAntesPt * 20) : undefined, after: p.espacamentoDepoisPt ? Math.round(p.espacamentoDepoisPt * 20) : undefined, line: p.espacamentoLinha ? Math.round(p.espacamentoLinha * 240) : undefined },
    border: p.citacao ? { left: { style: BorderStyle.SINGLE, size: 8, color: '808080' } } : undefined, ...extra,
  });
  const filhos: FileChild[] = [];
  for (const secao of documento.secoes) {
    if (secao.titulo) filhos.push(para(secao.titulo));
    for (const bloco of secao.blocos) {
      if (bloco.tipo === 'paragrafo') filhos.push(para(bloco));
      else if (bloco.tipo === 'lista') bloco.itens.forEach(item => filhos.push(para(item, bloco.ordenada ? { numbering: { reference: 'numerada', level: bloco.nivel } } : { bullet: { level: bloco.nivel } })));
      else if (bloco.tipo === 'quebra-pagina') filhos.push(new Paragraph({ children: [new PageBreak()] }));
      else if (bloco.tipo === 'linha-horizontal') filhos.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '808080' } } }));
      else if (bloco.tipo === 'tabela') {
        const rows = bloco.linhas.map(linha => new TableRow({ children: linha.map(celula => new TableCell({
          children: (celula.blocos?.flatMap(bloco => {
            if (bloco.tipo === 'paragrafo') return [para(bloco)];
            if (bloco.tipo === 'figura') { const tipo = normalizarTipoImagemDocx(bloco.formato); const figura = tipo ? [new Paragraph({ alignment: alinhar(bloco.alinhamento), children: [new ImageRun({ type: tipo, data: Buffer.from(bloco.base64, 'base64'), transformation: { width: bloco.larguraPx || 180, height: bloco.alturaPx || 135 } })] })] : []; return bloco.legenda ? [...figura, para(bloco.legenda, { alignment: AlignmentType.CENTER })] : figura; }
            if (bloco.tipo === 'linha-horizontal') return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '808080' } } })];
            if (bloco.tipo === 'lista') return bloco.itens.map(item => para(item, bloco.ordenada ? { numbering: { reference: 'numerada', level: bloco.nivel } } : { bullet: { level: bloco.nivel } }));
            return [];
          }) || celula.paragrafos.map(p => para(p))), columnSpan: celula.colspan, rowSpan: celula.rowspan,
          shading: celula.corFundo ? { fill: celula.corFundo } : undefined,
          borders: { top: { style: BorderStyle.SINGLE, size: 4, color: '808080' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: '808080' }, left: { style: BorderStyle.SINGLE, size: 4, color: '808080' }, right: { style: BorderStyle.SINGLE, size: 4, color: '808080' } },
        })) }));
        filhos.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
      }
      else { const tipo = normalizarTipoImagemDocx(bloco.formato); if (tipo) filhos.push(new Paragraph({ alignment: alinhar(bloco.alinhamento), keepNext: Boolean(bloco.legenda), children: [new ImageRun({ type: tipo, data: Buffer.from(bloco.base64, 'base64'), transformation: { width: bloco.larguraPx || 500, height: bloco.alturaPx || 375 } })] })); if (bloco.legenda) filhos.push(para(bloco.legenda, { alignment: AlignmentType.CENTER })); }
    }
  }
  const cab = cabecalho || documento.cabecalho;
  const filhosCabecalho: InstanceType<typeof Paragraph>[] = [];
  if (cab?.logoBase64) filhosCabecalho.push(new Paragraph({ alignment: alinhar(cab.alinhamento), children: [new ImageRun({ type: 'png', data: Buffer.from(cab.logoBase64, 'base64'), transformation: { width: 120, height: 60 } })] }));
  if (cab?.texto) filhosCabecalho.push(new Paragraph({ alignment: alinhar(cab.alinhamento), children: [new TextRun(cab.texto)] }));
  const cabecalhos = filhosCabecalho.length ? { first: new Header({ children: filhosCabecalho }) } : undefined;
  return Packer.toBuffer(new Document({ numbering: { config: [{ reference: 'numerada', levels: Array.from({ length: 9 }, (_, level) => ({ level, format: 'decimal', text: '%1.', alignment: AlignmentType.START })) }] }, styles: { default: { document: { run: { font: documento.fontePadrao, size: Math.round(documento.tamanhoPadraoPt * 2) } } } }, sections: [{ properties: { titlePage: Boolean(cabecalhos), page: { margin: Object.fromEntries(Object.entries(margens || documento.margens || {}).map(([k, v]) => [k, Math.round(Number(v) * 567)])) } }, headers: cabecalhos, children: filhos }] }));
}

export async function gerarODT(documento: Buffer): Promise<Buffer> {
  const libre = await import('libreoffice-convert');
  const executavel = await localizarExecutavelLibreOffice();
  return new Promise<Buffer>((resolve, reject) => {
    libre.convertWithOptions(documento, 'odt', undefined, {
      fileName: 'laudo.docx',
      ...(executavel ? { sofficeBinaryPaths: [executavel] } : {}),
    }, (erro, resultado) => erro ? reject(erro) : resolve(resultado));
  });
}

export async function verificarLibreOffice(): Promise<boolean> {
  if (disponibilidadeLibreOfficeEmCache !== null) return disponibilidadeLibreOfficeEmCache;
  if (verificacaoLibreOfficeEmAndamento) return verificacaoLibreOfficeEmAndamento;

  verificacaoLibreOfficeEmAndamento = verificarDisponibilidadeLibreOffice()
    .then(disponivel => {
      disponibilidadeLibreOfficeEmCache = disponivel;
      return disponivel;
    })
    .finally(() => {
      verificacaoLibreOfficeEmAndamento = null;
    });

  return verificacaoLibreOfficeEmAndamento;
}

export async function exportarLaudo(params: ExportarParams): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    if (params.formato === 'odt' && !(await verificarLibreOffice())) {
      return { success: false, error: 'LibreOffice não está disponível para exportar ODT' };
    }
    const numeroRep = await extrairNumeroRep(params.laudoId);
    const nomePadrao = obterNomeArquivoLaudo(numeroRep, params.formato);

    const filtros: Record<string, { name: string; extensions: string[] }[]> = {
      pdf: [{ name: 'Documento PDF', extensions: ['pdf'] }],
      docx: [{ name: 'Documento Word', extensions: ['docx'] }],
      odt: [{ name: 'Documento OpenDocument', extensions: ['odt'] }],
    };

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Exportar laudo como ${params.formato.toUpperCase()}`,
      defaultPath: nomePadrao,
      filters: filtros[params.formato] || [],
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Operação cancelada pelo usuário' };
    }

    let buffer: Buffer;

    switch (params.formato) {
      case 'pdf':
        buffer = await gerarPDF(params.html, params.margens, params.cabecalho?.texto);
        break;

      case 'docx':
        if (!documentoValido(params.estrutura)) return { success: false, error: 'Estrutura canônica do documento inválida para DOCX' };
        buffer = await gerarDOCXCanonico(params.estrutura, params.cabecalho, params.margens);
        break;

      case 'odt':
        if (!documentoValido(params.estrutura)) return { success: false, error: 'Estrutura canônica do documento inválida para ODT' };
        buffer = await gerarODT(await gerarDOCXCanonico(params.estrutura, params.cabecalho, params.margens));
        break;

      default:
        return { success: false, error: `Formato não suportado: ${params.formato}` };
    }

    fs.writeFileSync(filePath, buffer);
    log.debug(`Laudo exportado: ${filePath}`);

    return { success: true, path: filePath };
  } catch (error: unknown) {
    log.error('Erro ao exportar laudo', { laudoId: params.laudoId, formato: params.formato, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao exportar',
    };
  }
}
