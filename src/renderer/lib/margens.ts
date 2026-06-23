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

export const CM_TO_INCHES = 1 / 2.54;

export const MARGINS_A4_MM = { width: 210, height: 297 } as const;

export function clampMargin(value: number): number {
  return Math.min(MARGINS_MAX, Math.max(MARGINS_MIN, Math.round(value * 10) / 10));
}

export async function getMargens(): Promise<Margins | undefined> {
  try {
    const r = await window.ipcAPI.configuracao.obter(PDF_MARGINS_KEY);
    if (r.success && r.data) {
      const parsed = JSON.parse(r.data) as Margins;
      return {
        top: parsed.top ?? DEFAULT_MARGINS.top,
        right: parsed.right ?? DEFAULT_MARGINS.right,
        bottom: parsed.bottom ?? DEFAULT_MARGINS.bottom,
        left: parsed.left ?? DEFAULT_MARGINS.left,
      };
    }
  } catch {
    /* fallback: retorna undefined → margens padrão (zero) */
  }
  return undefined;
}

