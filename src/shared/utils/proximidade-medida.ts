import type { ComparacaoMedida } from '../types/projetil.types.js';

export const LIMITE_PROXIMIDADE_PERCENTUAL = 5;

export function medidaProximaDaReferencia(comparacao: ComparacaoMedida, limitePercentual = LIMITE_PROXIMIDADE_PERCENTUAL): boolean {
  const { observado, referenciaMin, referenciaMax, utilizada } = comparacao;
  if (!Number.isFinite(limitePercentual) || limitePercentual < 0 || limitePercentual > 100
    || !utilizada || observado === null || referenciaMin === null || referenciaMax === null
    || !Number.isFinite(observado) || !Number.isFinite(referenciaMin) || !Number.isFinite(referenciaMax)
    || observado <= 0 || referenciaMin <= 0 || referenciaMax < referenciaMin) return false;
  if (observado >= referenciaMin && observado <= referenciaMax) return true;
  const limite = observado < referenciaMin ? referenciaMin : referenciaMax;
  if (limitePercentual === 0) return false;
  const tolerancia = limite * (limitePercentual / 100);
  // Compensa somente o arredondamento binário na fronteira percentual.
  const margemNumerica = Number.EPSILON * Math.max(observado, limite) * 4;
  return Math.abs(observado - limite) <= tolerancia + margemNumerica;
}
