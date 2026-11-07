export const ENQUADRAMENTOS_PARES_FIGURAS = ['conter-3x2', 'conter-4x3', 'conter-1x1'] as const;

export type EnquadramentoParFiguras = typeof ENQUADRAMENTOS_PARES_FIGURAS[number];

export const ALTURA_MINIMA_PAR_FIGURAS = 67;
export const ALTURA_MAXIMA_PAR_FIGURAS = 150;
export const AJUSTE_VISUAL_MINIMO_ALTURA_PAR = 0;
export const AJUSTE_VISUAL_MAXIMO_ALTURA_PAR = 100;
export const PASSO_AJUSTE_VISUAL_ALTURA_PAR = 5;
export const AJUSTE_VISUAL_PADRAO_ALTURA_PAR = 50;
export const ALTURA_PADRAO_PAR_FIGURAS = 109;

export const ENQUADRAMENTO_PADRAO_PAR_FIGURAS: EnquadramentoParFiguras = 'conter-3x2';

export const PROPORCOES_ENQUADRAMENTO_PAR: Record<EnquadramentoParFiguras, number> = {
  'conter-3x2': 3 / 2,
  'conter-4x3': 4 / 3,
  'conter-1x1': 1,
};

export const ROTULOS_ENQUADRAMENTO_PAR: Record<EnquadramentoParFiguras, string> = {
  'conter-3x2': '3:2',
  'conter-4x3': '4:3',
  'conter-1x1': '1:1',
};

export const ALTURAS_ENQUADRAMENTO_LEGADO: Record<EnquadramentoParFiguras, number> = {
  'conter-3x2': 67,
  'conter-4x3': 75,
  'conter-1x1': 100,
};

export const AJUSTES_VISUAIS_PAR_FIGURAS = ['preencher', 'conter'] as const;
export type AjusteVisualParFiguras = typeof AJUSTES_VISUAIS_PAR_FIGURAS[number];
export const AJUSTE_VISUAL_PADRAO_PAR_FIGURAS: AjusteVisualParFiguras = 'conter';

export function ajusteVisualParFigurasValido(valor: unknown): valor is AjusteVisualParFiguras {
  return typeof valor === 'string' && AJUSTES_VISUAIS_PAR_FIGURAS.includes(valor as AjusteVisualParFiguras);
}

export function normalizarAjusteVisualParFiguras(valor: unknown): AjusteVisualParFiguras {
  return ajusteVisualParFigurasValido(valor) ? valor : AJUSTE_VISUAL_PADRAO_PAR_FIGURAS;
}

export function enquadramentoParFigurasValido(valor: unknown): valor is EnquadramentoParFiguras {
  return typeof valor === 'string' && ENQUADRAMENTOS_PARES_FIGURAS.includes(valor as EnquadramentoParFiguras);
}

export function alturaParFigurasValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor)
    && valor >= ALTURA_MINIMA_PAR_FIGURAS && valor <= ALTURA_MAXIMA_PAR_FIGURAS;
}

export function normalizarAlturaParFiguras(valor: unknown): number {
  const numero = typeof valor === 'string' && valor.trim() ? Number(valor) : valor;
  return alturaParFigurasValida(numero) ? numero : ALTURA_PADRAO_PAR_FIGURAS;
}

export function alturaEnquadramentoLegado(valor: unknown): number | undefined {
  return enquadramentoParFigurasValido(valor) ? ALTURAS_ENQUADRAMENTO_LEGADO[valor] : undefined;
}

export function proporcaoPorAlturaParFiguras(alturaPercentual: number): number {
  return 100 / normalizarAlturaParFiguras(alturaPercentual);
}

export function alturaParPorAjusteVisual(ajusteVisual: number): number {
  const ajuste = Math.min(AJUSTE_VISUAL_MAXIMO_ALTURA_PAR, Math.max(AJUSTE_VISUAL_MINIMO_ALTURA_PAR, ajusteVisual));
  return Math.round(ALTURA_MINIMA_PAR_FIGURAS
    + ((ALTURA_MAXIMA_PAR_FIGURAS - ALTURA_MINIMA_PAR_FIGURAS) * ajuste / AJUSTE_VISUAL_MAXIMO_ALTURA_PAR));
}

export function ajusteVisualPorAlturaPar(alturaPercentual: number): number {
  const altura = normalizarAlturaParFiguras(alturaPercentual);
  const ajuste = ((altura - ALTURA_MINIMA_PAR_FIGURAS) * AJUSTE_VISUAL_MAXIMO_ALTURA_PAR)
    / (ALTURA_MAXIMA_PAR_FIGURAS - ALTURA_MINIMA_PAR_FIGURAS);
  return Math.round(ajuste / PASSO_AJUSTE_VISUAL_ALTURA_PAR) * PASSO_AJUSTE_VISUAL_ALTURA_PAR;
}

export function ajustarNivelEnquadramentoPar(
  atual: EnquadramentoParFiguras,
  direcao: 'aumentar' | 'reduzir',
): EnquadramentoParFiguras {
  const indice = ENQUADRAMENTOS_PARES_FIGURAS.indexOf(atual);
  const deslocamento = direcao === 'aumentar' ? 1 : -1;
  return ENQUADRAMENTOS_PARES_FIGURAS[Math.min(
    ENQUADRAMENTOS_PARES_FIGURAS.length - 1,
    Math.max(0, indice + deslocamento),
  )];
}
