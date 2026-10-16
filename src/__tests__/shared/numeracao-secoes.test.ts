import { describe, expect, it } from 'vitest';
import { calcularNumeracaoSecoes } from '../../shared/utils/numeracao-secoes';

describe('numeração de seções', () => {
  it('mantém a contagem por padrão, inclusive para títulos ocultos', () => {
    expect(calcularNumeracaoSecoes([
      { nivel: 2, ocultarTitulo: true }, { nivel: 3 }, { nivel: 2 },
    ])).toEqual(['1.', '1.1', '2.']);
  });

  it('não conta pais ocultos desmarcados e deixa seus filhos sem número', () => {
    expect(calcularNumeracaoSecoes([
      { nivel: 2, ocultarTitulo: true, contarNaNumeracao: false },
      { nivel: 3 }, { nivel: 3, ocultarTitulo: true },
      { nivel: 2, ocultarTitulo: true, contarNaNumeracao: false },
      { nivel: 3 }, { nivel: 2 }, { nivel: 3 },
    ])).toEqual(['', '', '', '', '', '1.', '1.1']);
  });

  it('mantém a sequência das subseções quando várias ocultas não contam', () => {
    expect(calcularNumeracaoSecoes([
      { nivel: 2 }, { nivel: 3 },
      { nivel: 3, ocultarTitulo: true, contarNaNumeracao: false },
      { nivel: 3, ocultarTitulo: true, contarNaNumeracao: false },
      { nivel: 3 }, { nivel: 2 }, { nivel: 3 },
    ])).toEqual(['1.', '1.1', '', '', '1.2', '2.', '2.1']);
  });

  it('volta a contar títulos exibidos sem modificar a preferência guardada', () => {
    const secoes = [{ nivel: 2 as const, ocultarTitulo: false, contarNaNumeracao: false }, { nivel: 2 as const }];
    expect(calcularNumeracaoSecoes(secoes)).toEqual(['1.', '2.']);
    expect(secoes[0].contarNaNumeracao).toBe(false);
    expect(calcularNumeracaoSecoes([{ ...secoes[0], ocultarTitulo: true }, secoes[1]])).toEqual(['', '1.']);
  });
});
