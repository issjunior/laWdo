import { describe, expect, it } from 'vitest';
import { numeroInteiroPorExtenso } from '@/lib/numero-extenso';

describe('números inteiros por extenso', () => {
  it.each([
    [0, 'zero'], [1, 'um'], [2, 'dois'], [16, 'dezesseis'], [21, 'vinte e um'],
    [100, 'cem'], [101, 'cento e um'], [200, 'duzentos'], [999, 'novecentos e noventa e nove'],
    [1000, 'mil'], [1001, 'mil e um'], [1100, 'mil e cem'], [1101, 'mil cento e um'],
    [21000, 'vinte e um mil'], [1000000, 'um milhão'], [2000000, 'dois milhões'],
    [1000001, 'um milhão e um'], [1000100, 'um milhão e cem'],
    [1234567, 'um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete'],
    [1000000000, 'um bilhão'], [2000000000000, 'dois trilhões'],
    [1000000000000000, 'um quadrilhão'],
    [Number.MAX_SAFE_INTEGER, 'nove quadrilhões sete trilhões cento e noventa e nove bilhões duzentos e cinquenta e quatro milhões setecentos e quarenta mil novecentos e noventa e um'],
  ])('converte %s para %s', (numero, esperado) => {
    expect(numeroInteiroPorExtenso(Number(numero))).toBe(esperado);
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('não apresenta número inválido como quantidade por extenso: %s', numero => {
    expect(numeroInteiroPorExtenso(numero)).toBe('');
  });
});
