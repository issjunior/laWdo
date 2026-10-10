import { describe, expect, it } from 'vitest';
import { consultarProjeteis } from '@shared/utils/consulta-projeteis';
import type { ConsultaProjetil, ProjetilReferencia } from '@shared/types/projetil.types';

const referencia = (id: string, alteracoes: Partial<ProjetilReferencia> = {}): ProjetilReferencia => ({
  id, calibre: id, tipo: 'ETOG', sigla: 'ETOG', massaGramas: 8,
  calibreRealMinMm: 9, calibreRealMaxMm: 9.02, alturaMinMm: 15.4, alturaMaxMm: 15.4,
  situacao: 'estimada', fonte: 'fonte', localizacao: 'linha 1', ...alteracoes,
});

const consulta: ConsultaProjetil = {
  calibreRealMm: 9.01, alturaMaximaMm: 15.4, massaGramas: 8, estado: 'integro',
  medidasConfiaveis: { calibreRealMm: true, alturaMaximaMm: true, massaGramas: true }, sigla: null,
};

describe('consulta de projéteis', () => {
  it('ordena pela proximidade sem eliminar divergências e posiciona dados ausentes depois', () => {
    const resultados = consultarProjeteis([
      referencia('fora', { calibreRealMinMm: 9.1, calibreRealMaxMm: 9.1 }),
      referencia('sem-altura', { alturaMinMm: null, alturaMaxMm: null }),
      referencia('dentro'),
    ], consulta);
    expect(resultados.map(item => item.projetil.id)).toEqual(['dentro', 'fora', 'sem-altura']);
    expect(resultados[0]?.calibreReal.diferenca).toBe(0);
    expect(resultados[1]?.calibreReal.diferenca).toBeCloseTo(0.09);
  });

  it('usa calibre real, massa e altura nesta ordem', () => {
    const resultados = consultarProjeteis([
      referencia('massa-proxima', { calibreRealMinMm: 9.05, calibreRealMaxMm: 9.05 }),
      referencia('calibre-proximo', { massaGramas: 10, calibreRealMinMm: 9.02, calibreRealMaxMm: 9.02 }),
    ], consulta);
    expect(resultados[0]?.projetil.id).toBe('calibre-proximo');
  });

  it('com perda de massa, prioriza referências iguais ou mais pesadas e não estima perda', () => {
    const resultados = consultarProjeteis([
      referencia('cinco', { massaGramas: 5 }),
      referencia('dez', { massaGramas: 10 }),
      referencia('oito', { massaGramas: 8 }),
    ], { ...consulta, massaGramas: 6, estado: 'perda_massa', medidasConfiaveis: { calibreRealMm: false, alturaMaximaMm: false, massaGramas: false } });
    expect(resultados.map(item => item.projetil.id)).toEqual(['dez', 'oito', 'cinco']);
    expect(resultados[0]?.massa.confiavel).toBe(false);
  });

  it('ignora medidas não confiáveis e filtra por sigla', () => {
    const resultados = consultarProjeteis([
      referencia('a', { calibreRealMinMm: 8, calibreRealMaxMm: 8 }),
      referencia('b', { calibreRealMinMm: 9, calibreRealMaxMm: 9, sigla: 'EXPO' }),
    ], { ...consulta, estado: 'deformado', medidasConfiaveis: { calibreRealMm: false, alturaMaximaMm: false, massaGramas: false }, sigla: 'ETOG' });
    expect(resultados.map(item => item.projetil.id)).toEqual(['a']);
  });
});
