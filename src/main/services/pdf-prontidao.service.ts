import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FalhaPdf, EtapaFalhaPdf } from '../../shared/types/pdf.types.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger('exportacao');
const LIMITE_PREPARACAO_MS = 15_000;
const LIMITE_IMPRESSAO_MS = 30_000;

export class ErroGeracaoPdf extends Error {
  constructor(readonly falhaPdf: FalhaPdf) {
    super(falhaPdf.codigo);
  }
}

export function falhaPdfDesconhecida(etapa: EtapaFalhaPdf): FalhaPdf {
  return { codigo: 'FALHA_PDF', etapa, tentarNovamente: true };
}

interface ResultadoProntidao {
  ok: boolean;
  codigo?: 'IMAGEM_INDISPONIVEL' | 'FONTE_INDISPONIVEL';
  posicaoImagem?: number;
  imagens: number;
  fontes: number;
}

function validarProntidao(valor: unknown): valor is ResultadoProntidao {
  if (!valor || typeof valor !== 'object') return false;
  const dado = valor as Record<string, unknown>;
  return typeof dado.ok === 'boolean'
    && Number.isInteger(dado.imagens) && Number.isInteger(dado.fontes)
    && (dado.codigo === undefined || dado.codigo === 'IMAGEM_INDISPONIVEL' || dado.codigo === 'FONTE_INDISPONIVEL')
    && (dado.posicaoImagem === undefined || (Number.isInteger(dado.posicaoImagem) && Number(dado.posicaoImagem) > 0));
}

const VERIFICAR_RECURSOS = String.raw`(async () => {
  await document.fonts.ready;
  const fontes = Array.from(document.fonts);
  if (fontes.some(fonte => fonte.status === 'error')) {
    return { ok: false, codigo: 'FONTE_INDISPONIVEL', imagens: 0, fontes: fontes.length };
  }
  const imagens = Array.from(document.images);
  const urls = new Set();
  for (const elemento of Array.from(document.querySelectorAll('*'))) {
    for (const estilo of [getComputedStyle(elemento), getComputedStyle(elemento, '::before'), getComputedStyle(elemento, '::after')]) {
      for (const propriedade of ['backgroundImage', 'listStyleImage', 'borderImageSource', 'content']) {
        const texto = estilo[propriedade];
        const padrao = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g;
        for (const achado of texto.matchAll(padrao)) {
          const url = (achado[1] || achado[2] || achado[3] || '').trim();
          if (url) urls.add(url);
        }
      }
    }
  }
  const recursos = [
    ...imagens.map((imagem, indice) => ({ imagem, posicao: indice + 1 })),
    ...Array.from(urls, (url, indice) => {
      const imagem = new Image();
      imagem.src = url;
      return { imagem, posicao: imagens.length + indice + 1 };
    }),
  ];
  const resultados = await Promise.all(recursos.map(async ({ imagem }) => {
    try {
      await imagem.decode();
      return imagem.complete && imagem.naturalWidth > 0;
    } catch {
      return false;
    }
  }));
  const falha = resultados.findIndex(resultado => !resultado);
  return falha >= 0
    ? { ok: false, codigo: 'IMAGEM_INDISPONIVEL', posicaoImagem: recursos[falha].posicao, imagens: recursos.length, fontes: fontes.length }
    : { ok: true, imagens: recursos.length, fontes: fontes.length };
})()`;

async function executarComLimite<T>(
  janela: BrowserWindow,
  etapa: EtapaFalhaPdf,
  limiteMs: number,
  operacao: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejeitarInterrupcao: (erro: Error) => void = () => undefined;
  const interrupcao = new Promise<never>((_resolve, reject) => { rejeitarInterrupcao = reject; });
  const interromper = () => rejeitarInterrupcao(new ErroGeracaoPdf(falhaPdfDesconhecida(etapa)));
  janela.on('closed', interromper);
  janela.webContents.on('render-process-gone', interromper);
  try {
    return await Promise.race([
      operacao(),
      interrupcao,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ErroGeracaoPdf({
          codigo: 'TEMPO_EXCEDIDO', etapa, tentarNovamente: true,
        })), limiteMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    janela.removeListener('closed', interromper);
    janela.webContents.removeListener('render-process-gone', interromper);
  }
}

function criarJanelaPdf(): BrowserWindow {
  return new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
}

export async function gerarPdfPreparado(
  html: string,
  opcoes: Electron.PrintToPDFOptions,
  cabecalho?: string,
): Promise<Buffer> {
  const inicio = performance.now();
  const janelas: BrowserWindow[] = [];
  const arquivos: string[] = [];
  let etapa: EtapaFalhaPdf = 'carregamento';
  let imagens = 0;
  let fontes = 0;
  const preparar = async (conteudo: string, origem: 'corpo' | 'cabecalho', restante: () => number): Promise<BrowserWindow> => {
    const janela = criarJanelaPdf();
    janelas.push(janela);
    const arquivo = path.join(app.getPath('temp'), `lawdo-pdf-${randomUUID()}.html`);
    arquivos.push(arquivo);
    fs.writeFileSync(arquivo, conteudo, 'utf-8');
    await executarComLimite(janela, 'carregamento', restante(), () => janela.loadFile(arquivo));
    etapa = 'recursos';
    const recebido: unknown = await executarComLimite(janela, 'recursos', restante(), () =>
      janela.webContents.executeJavaScript(VERIFICAR_RECURSOS));
    if (!validarProntidao(recebido)) throw new ErroGeracaoPdf(falhaPdfDesconhecida('recursos'));
    imagens += recebido.imagens;
    fontes += recebido.fontes;
    if (!recebido.ok) {
      throw new ErroGeracaoPdf({
        codigo: recebido.codigo || 'FALHA_PDF',
        etapa: 'recursos',
        tentarNovamente: true,
        posicaoImagem: recebido.posicaoImagem,
        origem,
      });
    }
    return janela;
  };

  try {
    const restante = () => Math.max(1, LIMITE_PREPARACAO_MS - (performance.now() - inicio));
    const janela = await preparar(html, 'corpo', restante);
    if (cabecalho) {
      const limpo = cabecalho.replace(/^\{\{ALIGN:[^}]+\}\}/, '');
      const documentoCabecalho = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: file: blob:; font-src data: file:; style-src 'unsafe-inline' file:; script-src 'none'"></head><body>${limpo}</body></html>`;
      await preparar(documentoCabecalho, 'cabecalho', restante);
    }
    etapa = 'impressao';
    const inicioImpressao = performance.now();
    const pdf = await executarComLimite(janela, 'impressao', LIMITE_IMPRESSAO_MS,
      () => janela.webContents.printToPDF(opcoes));
    log.debug('PDF gerado', {
      preparacaoMs: Math.round(inicioImpressao - inicio),
      impressaoMs: Math.round(performance.now() - inicioImpressao),
      imagens,
      fontes,
    });
    return Buffer.from(pdf);
  } catch (erro: unknown) {
    const falha = erro instanceof ErroGeracaoPdf ? erro.falhaPdf : falhaPdfDesconhecida(etapa);
    log.error('Falha na geração do PDF', { codigo: falha.codigo, etapa: falha.etapa, origem: falha.origem });
    throw new ErroGeracaoPdf(falha);
  } finally {
    for (const janela of janelas) {
      if (!janela.isDestroyed()) janela.close();
    }
    for (const arquivo of arquivos) {
      try { fs.unlinkSync(arquivo); } catch { /* arquivo temporário já removido */ }
    }
  }
}
