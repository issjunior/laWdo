import type { MargensExportacao } from '../../shared/types/exportacao.types.js';
import { MARGENS_PADRAO_PDF } from '../../shared/configuracoes/margens-pdf.js';

const CM_POR_POLEGADA = 2.54;
export const LARGURA_A4_CM = 21;
export const ALTURA_A4_CM = 29.7;
export const SEPARACAO_CABECALHO_CM = 0.3;
export const PIXELS_POR_CM = 96 / CM_POR_POLEGADA;

export function criarOpcoesPdf(margens?: MargensExportacao, cabecalho?: string): Electron.PrintToPDFOptions {
  const base = margens ?? MARGENS_PADRAO_PDF;
  const margem = (chave: keyof MargensExportacao): number => {
    const valor = base[chave];
    return Number.isFinite(valor) && valor >= 0 && valor <= 5 ? valor : MARGENS_PADRAO_PDF[chave];
  };
  const efetivas = { top: margem('top'), right: margem('right'), bottom: margem('bottom'), left: margem('left') };
  const opcoes: Electron.PrintToPDFOptions = {
    printBackground: true,
    pageSize: 'A4',
    landscape: false,
    preferCSSPageSize: false,
    margins: Object.fromEntries(Object.entries(efetivas).map(([chave, valor]) => [chave, valor / CM_POR_POLEGADA])),
  };
  if (cabecalho) {
    const alinhamento = cabecalho.match(/^\{\{ALIGN:([^}]+)\}\}/)?.[1];
    const textoAlinhamento = alinhamento === 'flex-end' ? 'right' : alinhamento === 'center' ? 'center' : 'left';
    const conteudo = cabecalho.replace(/^\{\{ALIGN:[^}]+\}\}/, '');
    opcoes.displayHeaderFooter = true;
    opcoes.headerTemplate = `<style>
      html, body { margin: 0 !important; padding: 0 !important; }
      #lawdo-cabecalho-pdf { position: fixed; top: ${efetivas.top}cm; left: ${efetivas.left}cm;
        width: ${LARGURA_A4_CM - efetivas.left - efetivas.right}cm; box-sizing: border-box;
        display: flow-root; text-align: ${textoAlinhamento};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px; line-height: 1.1; color: #1a1a1a; }
      #lawdo-cabecalho-pdf *, #lawdo-cabecalho-pdf *::before, #lawdo-cabecalho-pdf *::after { box-sizing: border-box; }
      #lawdo-cabecalho-pdf p, #lawdo-cabecalho-pdf div { margin: 0; padding: 0; line-height: 1.1; }
      #lawdo-cabecalho-pdf img { max-width: 100%; }
    </style><div id="lawdo-cabecalho-pdf">${conteudo}</div>`;
    opcoes.footerTemplate = '<div></div>';
  }
  return opcoes;
}

export function reservarEspacoCabecalho(opcoes: Electron.PrintToPDFOptions, alturaPixels: unknown): Electron.PrintToPDFOptions {
  if (typeof alturaPixels !== 'number' || !Number.isFinite(alturaPixels) || alturaPixels <= 0) {
    throw new Error('Não foi possível medir o cabeçalho do PDF.');
  }
  const topo = (opcoes.margins?.top ?? 0) + (alturaPixels / PIXELS_POR_CM + SEPARACAO_CABECALHO_CM) / CM_POR_POLEGADA;
  if ((topo + (opcoes.margins?.bottom ?? 0)) * CM_POR_POLEGADA >= ALTURA_A4_CM - 1) {
    throw new Error('O cabeçalho não deixa espaço suficiente para o conteúdo do PDF.');
  }
  return { ...opcoes, margins: { ...opcoes.margins, top: topo } };
}
