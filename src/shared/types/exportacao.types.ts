export type AlinhamentoDocumento = 'left' | 'center' | 'right' | 'justify';

export interface EstiloTextoExportacao {
  negrito?: boolean; italico?: boolean; sublinhado?: boolean; tachado?: boolean;
  subscrito?: boolean; sobrescrito?: boolean; fonte?: string; tamanhoPt?: number;
  cor?: string; realce?: string; link?: string;
}

export interface TrechoExportacao { texto: string; estilo?: EstiloTextoExportacao; quebraLinha?: boolean; }
export interface ParagrafoExportacao {
  tipo: 'paragrafo'; trechos: TrechoExportacao[]; alinhamento?: AlinhamentoDocumento;
  nivelTitulo?: number; recuoEsquerdoPt?: number; recuoDireitoPt?: number;
  recuoPrimeiraLinhaPt?: number; espacamentoAntesPt?: number; espacamentoDepoisPt?: number;
  espacamentoLinha?: number; citacao?: boolean; preFormatado?: boolean;
}
export interface ListaExportacao { tipo: 'lista'; ordenada: boolean; nivel: number; itens: ParagrafoExportacao[]; }
export interface CelulaTabelaExportacao { paragrafos: ParagrafoExportacao[]; colspan?: number; rowspan?: number; larguraPercentual?: number; corFundo?: string; }
export interface TabelaExportacao { tipo: 'tabela'; linhas: CelulaTabelaExportacao[][]; largurasPercentuais?: number[]; }
export interface FiguraExportacao { tipo: 'figura'; base64: string; formato: string; larguraPx?: number; alturaPx?: number; alinhamento?: AlinhamentoDocumento; legenda?: ParagrafoExportacao; }
export interface LinhaHorizontalExportacao { tipo: 'linha-horizontal'; }
export type BlocoExportacao = ParagrafoExportacao | ListaExportacao | TabelaExportacao | FiguraExportacao | LinhaHorizontalExportacao;
export interface SecaoExportacao { titulo?: ParagrafoExportacao; blocos: BlocoExportacao[]; }
export interface CabecalhoExportacao { logoBase64?: string; texto?: string; alinhamento?: AlinhamentoDocumento; }
export interface MargensExportacao { top: number; right: number; bottom: number; left: number; }
export interface DocumentoExportacao { versao: 1; fontePadrao: string; tamanhoPadraoPt: number; secoes: SecaoExportacao[]; cabecalho?: CabecalhoExportacao; margens?: MargensExportacao; }
