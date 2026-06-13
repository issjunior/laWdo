import { app, dialog, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getLogger } from '../utils/logger.js';

const log = getLogger('exportacao');

const CM_TO_INCHES = 1 / 2.54;

export interface ExportarParams {
  laudoId: string;
  formato: 'pdf' | 'docx' | 'odt';
  html: string;
  estrutura?: any;
  cabecalho?: { logoBase64?: string; texto?: string; alinhamento?: string };
  margens?: { top: number; right: number; bottom: number; left: number };
  nomeArquivo?: string;
}

function removerZerosEsquerda(numero: string): string {
  return numero.replace(/^0+/, '') || '0';
}

function buildNomeArquivo(numeroRep: string, formato: string): string {
  const partes = numeroRep.split('/');
  const numero = partes.length > 1 ? removerZerosEsquerda(partes[1]) : removerZerosEsquerda(partes[0]);
  const ano = partes.length > 1 ? partes[0] : '';
  return ano ? `${numero}-${ano}.${formato}` : `${numero}.${formato}`;
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

function dataUriToBuffer(dataUri: string): { buffer: Buffer; formato: string } | null {
  const match = dataUri.match(/^data:image\/(jpeg|png|jpg|gif|webp);base64,(.+)$/i);
  if (!match) return null;
  const formato = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  return { buffer: Buffer.from(match[2], 'base64'), formato };
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
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  table th, table td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  table th { background: #f5f5f5; font-weight: 600; }
  ul, ol { margin: 8px 0; padding-left: 24px; }
  li { margin-bottom: 4px; }
  img { max-width: 100%; height: auto; display: block; margin: 10px auto; }
  .laudo-figure { text-align: center; margin: 12px auto; page-break-inside: avoid; }
  figcaption { font-size: 12px; color: #444; font-weight: bold; margin-top: 4px; }
</style>
</head>
<body>${html}</body>
</html>`;

    win = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
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
    log.info('PDF exportado com sucesso');
    return buffer;
  } finally {
    if (win) { try { win.close(); } catch { /* ignora */ } }
    if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch { /* ignora */ } }
  }
}

async function gerarDOCX(estrutura: any, cabecalho?: ExportarParams['cabecalho'], margens?: ExportarParams['margens']): Promise<Buffer> {
  const docx = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, ImageRun, Header, WidthType,
  } = docx;

  const children: any[] = [];
  const imagensMap = new Map<string, { base64: string; formato: string }>();

  if (estrutura.imagens) {
    for (const img of estrutura.imagens) {
      imagensMap.set(img.id, { base64: img.base64, formato: img.formato });
    }
  }

  function parseInlineHtml(html: string): any[] {
    const runs: any[] = [];
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
            underline: currentUnderline ? { type: 'single' as any } : undefined,
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

  function alinhamentoToAlignmentType(alinhamento?: string): string {
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
        }));
      }

      if (secao.elementos) {
        for (const el of secao.elementos) {
          switch (el.tipo) {
            case 'paragrafo': {
              const runs = parseInlineHtml(el.html);
              if (runs.length > 0) {
                const isHeading = el.nivelTitulo && el.nivelTitulo >= 3 && el.nivelTitulo <= 6;
                children.push(new Paragraph({
                  ...(isHeading ? { heading: `Heading${el.nivelTitulo}` as any } : {}),
                  alignment: alinhamentoToAlignmentType(el.alinhamento) as any,
                  children: runs,
                }));
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
                  children.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({
                      type: imgData.formato as any,
                      data: imgBuffer,
                      transformation: { width: 450, height: 300 },
                    })],
                  }));
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

  const sectionOpts: any = { children };

  if (margens) {
    const CM_TO_TWIP = 567;
    sectionOpts.properties = {
      page: {
        margin: {
          top: Math.round(margens.top * CM_TO_TWIP),
          right: Math.round(margens.right * CM_TO_TWIP),
          bottom: Math.round(margens.bottom * CM_TO_TWIP),
          left: Math.round(margens.left * CM_TO_TWIP),
        },
      },
    };
  }

  const headers: any = {};
  if (cabecalho?.texto || cabecalho?.logoBase64) {
    const headerChildren: any[] = [];

    if (cabecalho.logoBase64) {
      try {
        const logoBuffer = Buffer.from(cabecalho.logoBase64, 'base64');
        headerChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({
            type: 'png' as any,
            data: logoBuffer,
            transformation: { width: 120, height: 60 },
          })],
        }));
      } catch { /* ignora logo inválido */ }
    }

    if (cabecalho.texto) {
      const align = cabecalho.alinhamento === 'center' ? AlignmentType.CENTER
        : cabecalho.alinhamento === 'right' ? AlignmentType.RIGHT
        : AlignmentType.LEFT;
      headerChildren.push(new Paragraph({
        alignment: align,
        children: [new TextRun({ text: cabecalho.texto, size: 18, color: '666666' })],
      }));
    }

    if (headerChildren.length > 0) {
      headers.first = new Header({ children: headerChildren });
    }
  }

  if (Object.keys(headers).length > 0) {
    sectionOpts.headers = headers;
  }

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

async function gerarODT(html: string): Promise<Buffer> {
  const { promisify } = await import('util');
  const libre = await import('libreoffice-convert');
  const convertAsync = promisify(libre.convert);

  const tmpDir = os.tmpdir();
  const tmpHtmlPath = path.join(tmpDir, `laudo-odt-${Date.now()}.html`);

  let htmlProcessado = html;

  const dataUriRegex = /<img[^>]+src="(data:image\/[^"]+)"[^>]*>/gi;
  const tempImages: string[] = [];
  let imgIndex = 0;

  htmlProcessado = htmlProcessado.replace(dataUriRegex, (_fullMatch: string, dataUri: string) => {
    const parsed = dataUriToBuffer(dataUri);
    if (!parsed) return _fullMatch;

    const ext = parsed.formato === 'jpeg' ? 'jpg' : parsed.formato;
    const tempPath = path.join(tmpDir, `laudo-img-${Date.now()}-${imgIndex++}.${ext}`);
    fs.writeFileSync(tempPath, parsed.buffer);
    tempImages.push(tempPath);
    return _fullMatch.replace(dataUri, `file:///${tempPath.replace(/\\/g, '/')}`);
  });

  fs.writeFileSync(tmpHtmlPath, htmlProcessado, 'utf-8');

  try {
    const htmlBuffer = fs.readFileSync(tmpHtmlPath);
    const odtBuffer: Buffer = await convertAsync(htmlBuffer, 'odt', undefined) as Buffer;

    log.info('ODT gerado com sucesso via LibreOffice');
    return odtBuffer;
  } finally {
    try { fs.unlinkSync(tmpHtmlPath); } catch { /* ignora */ }
    for (const imgPath of tempImages) {
      try { fs.unlinkSync(imgPath); } catch { /* ignora */ }
    }
  }
}

export async function verificarLibreOffice(): Promise<boolean> {
  try {
    const libre = await import('libreoffice-convert');
    const { promisify } = await import('util');
    const convertAsync = promisify(libre.convert);

    const testHtml = '<html><body><p>test</p></body></html>';
    const result = await convertAsync(Buffer.from(testHtml, 'utf-8'), 'odt', undefined);
    return Buffer.isBuffer(result) && result.length > 0;
  } catch {
    return false;
  }
}

export async function exportarLaudo(params: ExportarParams): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const numeroRep = await extrairNumeroRep(params.laudoId);
    const nomePadrao = buildNomeArquivo(numeroRep, params.formato);

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
        if (!params.estrutura) return { success: false, error: 'Estrutura do documento não fornecida para DOCX' };
        buffer = await gerarDOCX(params.estrutura, params.cabecalho, params.margens);
        break;

      case 'odt':
        buffer = await gerarODT(params.html);
        break;

      default:
        return { success: false, error: `Formato não suportado: ${params.formato}` };
    }

    fs.writeFileSync(filePath, buffer);
    log.info(`Laudo exportado: ${filePath}`);

    return { success: true, path: filePath };
  } catch (error: any) {
    log.error('Erro ao exportar laudo', { laudoId: params.laudoId, formato: params.formato, error });
    return { success: false, error: error.message || 'Erro desconhecido ao exportar' };
  }
}
