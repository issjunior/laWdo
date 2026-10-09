import { describe, expect, it } from 'vitest';
import { catalogoProjeteis } from '@shared/catalogos/projeteis.catalogo';

describe('catálogo de projéteis', () => {
  it('usa somente documentos fornecidos com rastreabilidade e faixas válidas', () => {
    expect(catalogoProjeteis.length).toBeGreaterThan(200);
    expect(new Set(catalogoProjeteis.map(item => item.id)).size).toBe(catalogoProjeteis.length);
    for (const item of catalogoProjeteis) {
      expect(item.fonte).toMatch(/pdf|xlsx|jpg/i);
      expect(item.localizacao).toBeTruthy();
      expect(item.massaGramas === null || item.massaGramas > 0).toBe(true);
      expect(item.calibreRealMinMm === null).toBe(item.calibreRealMaxMm === null);
      expect(item.alturaMinMm === null).toBe(item.alturaMaxMm === null);
      if (item.calibreRealMinMm !== null && item.calibreRealMaxMm !== null) expect(item.calibreRealMinMm).toBeLessThanOrEqual(item.calibreRealMaxMm);
      if (item.alturaMinMm !== null && item.alturaMaxMm !== null) expect(item.alturaMinMm).toBeLessThanOrEqual(item.alturaMaxMm);
    }
  });

  it('preserva literalmente a linha questionável do PDF e identifica sua origem', () => {
    expect(catalogoProjeteis.find(item => item.id === 'pdf-004')).toMatchObject({
      calibre: '.223 Rem', massaGramas: 19.65, alturaMaxMm: 5.68,
      fonte: 'tabela de calibres_balistica forense_final.pdf',
    });
    expect(catalogoProjeteis.find(item => item.id === 'pdf-004')?.observacao).toContain('Possível inconsistência');
    expect(catalogoProjeteis.some(item => item.id === 'cbc-070')).toBe(false);
  });
});
