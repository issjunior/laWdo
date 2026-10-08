import { describe, expect, it } from 'vitest';
import { consultarProjeteis } from '@shared/utils/consulta-projeteis';
import type { ConsultaProjetil, ProjetilReferencia } from '@shared/types/projetil.types';

const referencia = (id: string, alteracoes: Partial<ProjetilReferencia> = {}): ProjetilReferencia => ({
  id, calibre: id, tipo: 'ETOG', massaGramas: 8,
  diametroMinMm: 9, diametroMaxMm: 9.02,
  comprimentoMinMm: 15.4, comprimentoMaxMm: 15.4,
  situacao: 'estimada', ...alteracoes,
});

const consulta: ConsultaProjetil = {
  massaGramas: 8, diametroMinMm: 9, diametroMaxMm: 9.1,
  comprimentoMinMm: 15.3, comprimentoMaxMm: 15.5,
};

describe('consulta de projéteis', () => {
  it('exclui medidas contraditórias e coloca referências parciais depois das completas', () => {
    const resultado = consultarProjeteis([
      referencia('completa'),
      referencia('sem-comprimento', { comprimentoMinMm: null, comprimentoMaxMm: null }),
      referencia('sem-diametro', { diametroMinMm: null, diametroMaxMm: null }),
      referencia('fora', { comprimentoMinMm: 18, comprimentoMaxMm: 18 }),
    ], consulta);
    expect(resultado.map(item => item.projetil.id)).toEqual(['completa', 'sem-comprimento', 'sem-diametro']);
    expect(resultado.map(item => item.compatibilidade)).toEqual(['compativel', 'parcial', 'parcial']);
    expect(resultado[0]).toMatchObject({ diametro: 'coincide', comprimento: 'coincide' });
    expect(resultado[1]).toMatchObject({ comprimento: 'ausente' });
  });

  it('usa proximidade de diâmetro antes de comprimento e massa', () => {
    const resultado = consultarProjeteis([
      referencia('massa-proxima', { massaGramas: 8, diametroMinMm: 9.08, diametroMaxMm: 9.08, comprimentoMinMm: 15.4, comprimentoMaxMm: 15.4 }),
      referencia('diametro-proximo', { massaGramas: 15, diametroMinMm: 9.05, diametroMaxMm: 9.05, comprimentoMinMm: 15.3, comprimentoMaxMm: 15.3 }),
    ], consulta);
    expect(resultado.map(item => item.projetil.id)).toEqual(['diametro-proximo', 'massa-proxima']);
  });

  it('usa comprimento antes de massa quando o diâmetro empata', () => {
    const resultado = consultarProjeteis([
      referencia('massa-proxima', { comprimentoMinMm: 15.5, comprimentoMaxMm: 15.5 }),
      referencia('comprimento-proximo', { massaGramas: 30 }),
    ], consulta);
    expect(resultado.map(item => item.projetil.id)).toEqual(['comprimento-proximo', 'massa-proxima']);
  });

  it('usa o selo apenas como desempate e preserva a ordem completa para o Top 10', () => {
    const itens = Array.from({ length: 12 }, (_, indice) => referencia(`item-${indice + 1}`, {
      massaGramas: 8 + indice / 10,
    })).reverse();
    itens.push(referencia('confirmada', { situacao: 'confirmada', massaGramas: 8 }));
    const resultado = consultarProjeteis(itens, consulta);
    expect(resultado[0]?.projetil.id).toBe('confirmada');
    expect(resultado.slice(1, 10).map(item => item.projetil.id)).toEqual(
      Array.from({ length: 9 }, (_, indice) => `item-${indice + 1}`),
    );
    expect(resultado).toHaveLength(13);
  });

  it('compara apenas a massa quando nenhuma dimensão foi informada', () => {
    const resultado = consultarProjeteis([
      referencia('pesada', { massaGramas: 30 }), referencia('proxima', { massaGramas: 8.1 }),
    ], { massaGramas: 8, diametroMinMm: null, diametroMaxMm: null, comprimentoMinMm: null, comprimentoMaxMm: null });
    expect(resultado.map(item => item.projetil.id)).toEqual(['proxima', 'pesada']);
    expect(resultado[0]?.compatibilidade).toBe('parcial');
  });
});
