import { describe, expect, it } from 'vitest';
import { medidaProximaDaReferencia } from '@shared/utils/proximidade-medida';
import type { ComparacaoMedida } from '@shared/types/projetil.types';

const comparar = (observado: number | null, minimo: number | null = 10, maximo: number | null = minimo, utilizada = true): ComparacaoMedida => ({
  observado, referenciaMin: minimo, referenciaMax: maximo, utilizada, diferenca: null,
});

describe('proximidade visual de medidas', () => {
  it('aceita limite configurável e zero somente para coincidências e faixas', () => {
    expect(medidaProximaDaReferencia(comparar(10.1), 0)).toBe(false);
    expect(medidaProximaDaReferencia(comparar(10), 0)).toBe(true);
    expect(medidaProximaDaReferencia(comparar(10, 9, 11), 0)).toBe(true);
    expect(medidaProximaDaReferencia(comparar(10.2), 2)).toBe(true);
    expect(medidaProximaDaReferencia(comparar(9.8), 2)).toBe(true);
    expect(medidaProximaDaReferencia(comparar(10.200000001), 2)).toBe(false);
    expect(medidaProximaDaReferencia(comparar(9.799999999), 2)).toBe(false);
    expect(medidaProximaDaReferencia(comparar(20), 100)).toBe(true);
    for (const limite of [-1, 101, NaN, Infinity]) expect(medidaProximaDaReferencia(comparar(10), limite)).toBe(false);
  });
  it.each([
    [10, true], [9.8, true], [10.2, true], [9.5, true], [10.5, true],
    [9.4999999999, false], [10.5000000001, false], [9, false], [11, false],
  ])('para referência 10, destaca %s: %s', (observado, esperado) => {
    expect(medidaProximaDaReferencia(comparar(observado))).toBe(esperado);
  });

  it('compensa arredondamento binário na fronteira percentual', () => {
    expect(medidaProximaDaReferencia(comparar(0.105, 0.1))).toBe(true);
    expect(medidaProximaDaReferencia(comparar(0.095, 0.1))).toBe(true);
    expect(medidaProximaDaReferencia(comparar(0.1050000001, 0.1))).toBe(false);
  });

  it.each([[9, true], [10, true], [11, true], [8.55, true], [11.55, true], [8.549999, false], [11.550001, false]])('na faixa 9–11, destaca %s: %s', (observado, esperado) => {
    expect(medidaProximaDaReferencia(comparar(observado, 9, 11))).toBe(esperado);
  });

  it('usa a referência como denominador, sem alterar o erro relativo da classificação', () => {
    expect(medidaProximaDaReferencia(comparar(9.5, 10))).toBe(true);
    expect(Math.abs(9.5 - 10) / 9.5).toBeGreaterThan(0.05);
  });

  it.each([null, 0, -1, NaN, Infinity])('não destaca valor observado inválido ou ausente: %s', observado => {
    expect(medidaProximaDaReferencia(comparar(observado))).toBe(false);
  });

  it('não destaca referências ausentes, inválidas ou fora da proximidade', () => {
    for (const medida of [comparar(10, null), comparar(10, 10, null), comparar(10, 11, 9), comparar(10, 0), comparar(10, NaN), comparar(10, 10, Infinity), comparar(10, 10, 10, false)]) {
      expect(medidaProximaDaReferencia(medida)).toBe(false);
    }
  });
});
