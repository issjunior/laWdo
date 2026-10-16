export function converterMedidaTextoParaPt(valor: string): number | null {
  if (!valor || valor.trim() === '0') return 0;
  const medida = /^(-?\d+(?:\.\d+)?)\s*(pt|px|cm|mm|in)$/i.exec(valor.trim());
  if (!medida) return null;
  const fatores: Record<string, number> = { pt: 1, px: 0.75, cm: 72 / 2.54, mm: 72 / 25.4, in: 72 };
  return Number(medida[1]) * fatores[medida[2].toLowerCase()];
}
