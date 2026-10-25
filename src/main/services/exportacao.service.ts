import { dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import type { DocumentoExportacao, MargensExportacao } from '../../shared/types/exportacao.types.js';
import { normalizarQuebrasPaginaHtml } from '../../shared/utils/quebra-pagina.js';
import { obterNomeArquivoLaudo } from '../../shared/utils/nomes-documentos-rep.js';
import type {
  ParagraphChild,
} from 'docx';
import { getLogger } from '../utils/logger.js';
import { ErroGeracaoPdf, gerarPdfPreparado } from './pdf-prontidao.service.js';
import { criarOpcoesPdf } from './pdf-layout.js';
import { ESTILOS_TABELAS_PLACEHOLDER_PDF } from './pdf-tabelas.js';
import type { FalhaPdf } from '../../shared/types/pdf.types.js';

const log = getLogger('exportacao');

let disponibilidadeLibreOfficeEmCache: boolean | null = null;
let verificacaoLibreOfficeEmAndamento: Promise<boolean> | null = null;

interface ExportacaoCabecalho {
  logoBase64?: string;
  texto?: string;
  alinhamento?: string;
}

export interface ExportarParams {
  laudoId: string;
  formato: 'pdf' | 'docx' | 'odt';
  html: string;
  estrutura?: DocumentoExportacao;
  cabecalho?: ExportacaoCabecalho;
  cabecalhoPaginasHtml?: string;
  margens?: MargensExportacao;
  nomeArquivo?: string;
}

type TipoImagemDocx = 'jpg' | 'png' | 'gif' | 'bmp';

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
    const bodyPadding = '0 0 12px 0';

    const docHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Laudo</title>
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
  p:not(table p):not(figure p) { text-align: justify; }
  table { border-collapse: collapse; width: 100% !important; max-width: 100% !important; margin: 12px 0; }
  table th, table td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  table th { background: #f5f5f5; font-weight: 600; }
  ${ESTILOS_TABELAS_PLACEHOLDER_PDF}
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
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

    const printOptions = criarOpcoesPdf(margens, headerTemplate);

    const buffer = await gerarPdfPreparado(docHtml, printOptions, headerTemplate);
    log.debug('PDF exportado com sucesso');
    return buffer;
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
    indent: { left: p.recuoEsquerdoPt ? Math.round(p.recuoEsquerdoPt * 20) : undefined, right: p.recuoDireitoPt ? Math.round(p.recuoDireitoPt * 20) : undefined, firstLine: p.recuoPrimeiraLinhaPt ? Math.round(p.recuoPrimeiraLinhaPt * 20) : undefined }, spacing: { before: p.espacamentoAntesPt !== undefined ? Math.round(p.espacamentoAntesPt * 20) : undefined, after: p.espacamentoDepoisPt !== undefined ? Math.round(p.espacamentoDepoisPt * 20) : undefined, line: p.espacamentoLinha ? Math.round(p.espacamentoLinha * 240) : undefined },
    border: p.citacao ? { left: { style: BorderStyle.SINGLE, size: 8, color: '808080' } } : undefined, ...extra,
  });
  const filhos: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];
  const secoes = documento.secoes.map(secao => ({ ...secao, fechamento: false }));
  if (documento.fechamento) secoes.push({ blocos: documento.fechamento.blocos, fechamento: true });
  for (const secao of secoes) {
    const inicioFilhos = filhos.length;
    if (secao.titulo) filhos.push(para(secao.titulo));
    for (const bloco of secao.blocos) {
      if (bloco.tipo === 'paragrafo') filhos.push(para(bloco));
      else if (bloco.tipo === 'lista') bloco.itens.forEach(item => filhos.push(para(item, bloco.ordenada ? { numbering: { reference: 'numerada', level: bloco.nivel } } : { bullet: { level: bloco.nivel } })));
      else if (bloco.tipo === 'quebra-pagina') filhos.push(new Paragraph({ children: [new PageBreak()] }));
      else if (bloco.tipo === 'linha-horizontal') filhos.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '808080' } } }));
      else if (bloco.tipo === 'tabela') {
        const rows = bloco.linhas.map(linha => new TableRow({ cantSplit: true, children: linha.map(celula => new TableCell({
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
    if (secao.fechamento) {
      const conteudo = filhos.splice(inicioFilhos);
      const semBorda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
      filhos.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda, insideHorizontal: semBorda, insideVertical: semBorda },
        rows: [new TableRow({ cantSplit: true, children: [new TableCell({
          children: conteudo,
          margins: { top: Math.round((documento.fechamento?.espacamentoAntesPt ?? 0) * 20), bottom: 0, left: 0, right: 0 },
        })] })],
      }));
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

export async function exportarLaudo(params: ExportarParams): Promise<{ success: boolean; path?: string; error?: string; falhaPdf?: FalhaPdf }> {
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
        buffer = await gerarPDF(params.html, params.margens, params.cabecalhoPaginasHtml);
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

    const arquivoTemporario = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(arquivoTemporario, buffer);
      fs.renameSync(arquivoTemporario, filePath);
    } catch (erro: unknown) {
      const codigo = erro && typeof erro === 'object' && 'code' in erro ? erro.code : undefined;
      if (codigo === 'EPERM' || codigo === 'EACCES' || codigo === 'EBUSY') {
        log.error('Documento gerado, mas o destino bloqueou o salvamento', { formato: params.formato, codigo });
        return {
          success: false,
          error: `O documento ${params.formato.toUpperCase()} foi gerado, mas não foi possível salvá-lo no destino escolhido. Feche o arquivo se estiver aberto em outro programa ou salve com outro nome ou em outra pasta. Verifique também a permissão de gravação.`,
        };
      }
      throw erro;
    } finally {
      try { fs.unlinkSync(arquivoTemporario); } catch { /* arquivo já movido ou removido */ }
    }
    log.debug(`Laudo exportado: ${filePath}`);

    return { success: true, path: filePath };
  } catch (error: unknown) {
    log.error('Erro ao exportar laudo', error instanceof ErroGeracaoPdf
      ? { formato: params.formato, falhaPdf: error.falhaPdf }
      : { laudoId: params.laudoId, formato: params.formato, error });
    return {
      success: false,
      error: error instanceof ErroGeracaoPdf ? 'Não foi possível preparar o PDF.' : error instanceof Error ? error.message : 'Erro desconhecido ao exportar',
      falhaPdf: error instanceof ErroGeracaoPdf ? error.falhaPdf : undefined,
    };
  }
}
