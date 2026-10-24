import type { MargensExportacao } from '../types/exportacao.types.js';

export const CHAVE_MARGENS_PDF = 'pdf_margins';
export const MARGENS_PADRAO_PDF: Readonly<MargensExportacao> = Object.freeze({
  top: 3.5,
  right: 2,
  bottom: 1.5,
  left: 3,
});
