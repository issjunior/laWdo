import { describe, expect, it } from 'vitest';
import { catalogoProjeteis } from '@shared/catalogos/projeteis.catalogo';

describe('catálogo inicial de projéteis', () => {
  it('contém variantes únicas com medidas estruturalmente válidas', () => {
    expect(catalogoProjeteis.length).toBeGreaterThan(100);
    expect(new Set(catalogoProjeteis.map(item => item.id)).size).toBe(catalogoProjeteis.length);
    for (const item of catalogoProjeteis) {
      expect(item.massaGramas).toBeGreaterThan(0);
      expect(item.situacao).toBe('estimada');
      expect(item.diametroMinMm === null).toBe(item.diametroMaxMm === null);
      expect(item.comprimentoMinMm === null).toBe(item.comprimentoMaxMm === null);
      if (item.diametroMinMm !== null && item.diametroMaxMm !== null) {
        expect(item.diametroMinMm).toBeLessThanOrEqual(item.diametroMaxMm);
      }
      if (item.comprimentoMinMm !== null && item.comprimentoMaxMm !== null) {
        expect(item.comprimentoMinMm).toBeLessThanOrEqual(item.comprimentoMaxMm);
      }
    }
  });

  it('não publica linhas com erros dimensionais demonstrados', () => {
    const ids = new Set(catalogoProjeteis.map(item => item.id));
    expect(ids.has('cbc-011')).toBe(false);
    expect(ids.has('cbc-077')).toBe(false);
    expect(ids.has('cbc-078')).toBe(false);
    expect(ids.has('computador-031')).toBe(false);
  });
});
