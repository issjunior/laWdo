export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const PDF_MARGINS_KEY = 'pdf_margins';

export const DEFAULT_MARGINS: Margins = { top: 2.5, right: 2.0, bottom: 2.5, left: 3.0 };

export const MARGINS_MIN = 0;
export const MARGINS_MAX = 5;
export const MARGINS_STEP = 0.1;

export const MARGINS_A4_MM = { width: 210, height: 297 } as const;

export function clampMargin(value: number): number {
  return Math.min(MARGINS_MAX, Math.max(MARGINS_MIN, Math.round(value * 10) / 10));
}

export function normalizarMargensConfiguracao(valor: unknown): Margins {
  let parsed: unknown = valor;
  if (typeof valor === 'string') {
    try {
      parsed = JSON.parse(valor) as unknown;
    } catch {
      return { ...DEFAULT_MARGINS };
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_MARGINS };
  const dados = parsed as Record<string, unknown>;
  const margem = (chave: keyof Margins): number => {
    const atual = dados[chave];
    return typeof atual === 'number' && Number.isFinite(atual) ? clampMargin(atual) : DEFAULT_MARGINS[chave];
  };
  return { top: margem('top'), right: margem('right'), bottom: margem('bottom'), left: margem('left') };
}

export async function getMargens(): Promise<Margins> {
  try {
    const r = await window.ipcAPI.configuracao.obter(PDF_MARGINS_KEY);
    if (r.success && r.data) {
      return normalizarMargensConfiguracao(r.data);
    }
  } catch {
    /* usa as margens seguras quando a configuração ainda não existe ou está inválida */
  }
  return { ...DEFAULT_MARGINS };
}
