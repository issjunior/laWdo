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
  it('incorpora as 43 linhas numéricas de Baruch sem inventar alturas', () => {
    const itens = catalogoProjeteis.filter(item => item.fonte === 'Perfis de Projéteis - Eliane Baruch.pdf');
    expect(catalogoProjeteis.flatMap(item => item.origens ?? []).filter(origem => origem.fonte === 'Perfis de Projéteis - Eliane Baruch.pdf')).toHaveLength(43);
    expect(itens.every(item => item.alturaMinMm === null && item.alturaMaxMm === null)).toBe(true);
    expect(itens.find(item => item.id === 'baruch-1-09')).toMatchObject({ calibre: '9mm Luger', massaGramas: 7.4, calibreRealMinMm: 9 });
    expect(itens.find(item => item.id === 'baruch-3-08')).toMatchObject({ calibre: '.223', massaGramas: 3.6 });
    expect(itens.find(item => item.id === 'baruch-1-01')?.origens?.[0]?.valoresOriginais).toMatchObject({ diametroPolegadas: '.251', massaGrains: 50, massaGramas: 3.2 });
  });

  it('dá preferência à tabela original na equivalência revisada, sem misturar medidas', () => {
    const original = catalogoProjeteis.find(item => item.id === 'pdf-007');
    expect(original).toMatchObject({ calibreRealMinMm: 7.65, alturaMinMm: 11.48, massaGramas: 4.6 });
    expect(catalogoProjeteis.some(item => item.id === 'baruch-1-02')).toBe(false);
    expect(original?.origens?.find(origem => origem.fonte === 'Perfis de Projéteis - Eliane Baruch.pdf')?.valoresOriginais).toMatchObject({ diametroMm: 7.8, massaGramas: 4.6 });
  });

  it('preserva variantes de massas e modelos distintos', () => {
    const luger = catalogoProjeteis.filter(item => item.fonte === 'Perfis de Projéteis - Eliane Baruch.pdf' && item.calibre === '9mm Luger' && item.sigla === 'ETOG');
    expect(luger.map(item => item.massaGramas)).toEqual([7.4, 8]);
    expect(catalogoProjeteis.find(item => item.id === 'baruch-2-01')?.tipo).not.toBe(catalogoProjeteis.find(item => item.id === 'baruch-2-02')?.tipo);
    expect(catalogoProjeteis.filter(item => item.tipo === 'ETPT Boat Tail' && item.calibre === '.308').map(item => item.massaGramas)).toEqual([9.7, 10.5]);
  });

  it.each([
    ['pdf-004', 5.56, 19.65, 5.68],
    ['pdf-010', 7.65, 8.066, 21.46],
    ['pdf-012', 9, 5.702, 17.39],
    ['baruch-4-07', 11.4, 15.5, null],
    ['baruch-4-09', 17.5, 24.8, null],
  ])('reintegra %s mantendo as medidas publicadas', (id, diametro, massa, altura) => {
    const item = catalogoProjeteis.find(referencia => referencia.id === id);
    expect(item).toMatchObject({ calibreRealMinMm: diametro, calibreRealMaxMm: diametro,
      massaGramas: massa, alturaMinMm: altura, alturaMaxMm: altura });
    expect(item?.motivoExclusaoClassificacao).toBeUndefined();
  });

  it('registra ressalvas concretas sem bloquear e remove os avisos genéricos sem evidência', () => {
    expect(catalogoProjeteis.find(item => item.id === 'pdf-004')?.observacao).toContain('altura de 5,68 mm e massa total de 19,65 g');
    expect(catalogoProjeteis.find(item => item.id === 'baruch-4-07')?.observacao).toContain('Diâmetro de 11,4 mm');
    expect(catalogoProjeteis.find(item => item.id === 'baruch-4-09')?.observacao).toContain('390 grains e 24,8 g');
    for (const id of ['pdf-010', 'pdf-012']) expect(catalogoProjeteis.find(item => item.id === id)?.observacao).toBeUndefined();
  });

  it('usa a massa publicada em gramas e preserva grains como valor original', () => {
    const balote = catalogoProjeteis.find(item => item.id === 'baruch-4-09');
    expect(balote?.massaGramas).toBe(24.8);
    expect(balote?.origens?.[0]).toMatchObject({
      fonte: 'Perfis de Projéteis - Eliane Baruch.pdf', localizacao: 'Página 4, linha 9',
      valoresOriginais: { diametroPolegadas: '.691', diametroMm: 17.5, massaGrains: 390, massaGramas: 24.8 },
    });
  });

  it.each([
    ['baruch-1-10', 9, 8, 'Página 1, linha 10'],
    ['baruch-2-04', 9, 9.5, 'Página 2, linha 4'],
    ['baruch-3-10', 6.7, 9.2, 'Página 3, linha 10'],
    ['baruch-4-06', 10.8, 12.9, 'Página 4, linha 6'],
  ])('confere a amostra documental %s sem preencher a altura ausente', (id, diametro, massa, localizacao) => {
    expect(catalogoProjeteis.find(item => item.id === id)).toMatchObject({
      calibreRealMinMm: diametro, calibreRealMaxMm: diametro, massaGramas: massa,
      alturaMinMm: null, alturaMaxMm: null, localizacao,
    });
  });

  it('preserva a procedência de todas as referências', () => {
    expect(catalogoProjeteis.every(item => item.origens?.length && item.origens.every(origem => origem.fonte && origem.localizacao))).toBe(true);
  });

});
