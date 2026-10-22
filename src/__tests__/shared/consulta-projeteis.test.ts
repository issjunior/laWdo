import { describe, expect, it } from 'vitest';
import { consultarProjeteis } from '@shared/utils/consulta-projeteis';
import { catalogoProjeteis } from '@shared/catalogos/projeteis.catalogo';
import type { ConsultaProjetil, ProjetilReferencia } from '@shared/types/projetil.types';

const referencia = (id: string, alteracoes: Partial<ProjetilReferencia> = {}): ProjetilReferencia => ({
  id, calibre: id, tipo: 'ETOG', sigla: 'ETOG', massaGramas: 10,
  calibreRealMinMm: 10, calibreRealMaxMm: 10, alturaMinMm: 20, alturaMaxMm: 20,
  situacao: 'estimada', fonte: 'fonte.pdf', localizacao: 'linha 1', ...alteracoes,
});
const consulta: ConsultaProjetil = {
  calibreRealMm: 10, alturaMaximaMm: 20, massaGramas: 10,
  medidaPrioritaria: 'massaGramas', perdaMaterial: false, sigla: null,
};
const ids = (itens: ProjetilReferencia[], alteracoes: Partial<ConsultaProjetil> = {}) =>
  consultarProjeteis(itens, { ...consulta, ...alteracoes }).map(item => item.projetil.id);

describe('consulta de projéteis por prioridade', () => {
  it('coloca o .38 SPL SEPO em primeiro para 9 / 16,03, mesmo com massa prioritária vazia', () => {
    const [primeiro] = consultarProjeteis(catalogoProjeteis, { ...consulta, calibreRealMm: 9, alturaMaximaMm: 16.03, massaGramas: null });
    expect(primeiro?.projetil.id).toBe('pdf-018');
    expect(primeiro?.medidasProximas).toEqual(['calibreRealMm', 'alturaMaximaMm']);
  });

  it('ordena por três, duas, uma e nenhuma medida próxima antes da pontuação', () => {
    const itens = [referencia('tres', { massaGramas: 10.1 }), referencia('duas', { massaGramas: null }),
      referencia('uma', { massaGramas: null, alturaMinMm: null, alturaMaxMm: null }),
      referencia('nenhuma', { massaGramas: null, alturaMinMm: null, alturaMaxMm: null, calibreRealMinMm: 20, calibreRealMaxMm: 20 })];
    const resultados = consultarProjeteis(itens.reverse(), consulta);
    expect(resultados.map(item => item.projetil.id)).toEqual(['tres', 'duas', 'uma', 'nenhuma']);
    expect(resultados.map(item => item.medidasProximas.length)).toEqual([3, 2, 1, 0]);
    expect(resultados[0]?.pontuacao).toBeGreaterThan(resultados[1]!.pontuacao!);
  });

  it('muda a ordem com o limite sem alterar pontuações ou arredondar valores das fontes', () => {
    const itens = [referencia('completa', { massaGramas: 10.4 }), referencia('parcial', { alturaMinMm: null, alturaMaxMm: null })];
    expect(ids(itens)).toEqual(['completa', 'parcial']);
    expect(ids(itens, { limiteProximidadePercentual: 0 })).toEqual(['parcial', 'completa']);
    const [resultado] = consultarProjeteis([referencia('precisa', { massaGramas: 5.702 })], { ...consulta, massaGramas: 5.7, limiteProximidadePercentual: 0 });
    expect(resultado?.medidasProximas).not.toContain('massaGramas');
    expect(resultado?.massa.diferenca).toBeCloseTo(-0.002, 12);
    expect(consultarProjeteis(itens, consulta).find(item => item.projetil.id === 'completa')?.pontuacao)
      .toBe(consultarProjeteis(itens, { ...consulta, limiteProximidadePercentual: 0 }).find(item => item.projetil.id === 'completa')?.pontuacao);
  });

  it('preserva grupos de massa antes da contagem e não conta massa com perda', () => {
    const resultados = consultarProjeteis([referencia('inferior', { massaGramas: 9 }), referencia('compativel', { massaGramas: 11, alturaMinMm: 30, alturaMaxMm: 30 })], { ...consulta, perdaMaterial: true });
    expect(resultados.map(item => item.projetil.id)).toEqual(['compativel', 'inferior']);
    expect(resultados[0]?.medidasProximas).toEqual(['calibreRealMm']);
    expect(resultados[1]?.medidasProximas).toEqual(['calibreRealMm', 'alturaMaximaMm']);
  });

  it.each([-1, 101, NaN, Infinity])('usa o padrão para limite inválido %s', limiteProximidadePercentual => {
    expect(ids([referencia('completa', { massaGramas: 10.4 }), referencia('parcial', { massaGramas: null })], { limiteProximidadePercentual })).toEqual(['completa', 'parcial']);
  });
  it('aplica pesos 60/20/20 e muda a ordem com a prioridade', () => {
    const itens = [referencia('massa-proxima', { calibreRealMinMm: 11, calibreRealMaxMm: 11 }), referencia('diametro-proximo', { massaGramas: 11 })];
    expect(ids(itens)).toEqual(['massa-proxima', 'diametro-proximo']);
    expect(ids(itens, { medidaPrioritaria: 'calibreRealMm' })).toEqual(['diametro-proximo', 'massa-proxima']);
    expect(consultarProjeteis(itens, consulta)[0]?.pontuacao).toBeCloseTo(0.02);
    expect(ids(itens, { medidaPrioritaria: 'alturaMaximaMm' })).toEqual(['diametro-proximo', 'massa-proxima']);
  });

  it('permite que divergências secundárias superem pequena vantagem na principal', () => {
    expect(ids([
      referencia('massa-exata', { calibreRealMinMm: 20, calibreRealMaxMm: 20, alturaMinMm: 40, alturaMaxMm: 40 }),
      referencia('conjunto-proximo', { massaGramas: 10.1 }),
    ])).toEqual(['conjunto-proximo', 'massa-exata']);
  });

  it('compara desvios relativos sem somar gramas com milímetros', () => {
    const [resultado] = consultarProjeteis([referencia('a', { massaGramas: 11, calibreRealMinMm: 12, calibreRealMaxMm: 12, alturaMinMm: 26, alturaMaxMm: 26 })], consulta);
    expect(resultado?.pontuacao).toBeCloseTo(0.16);
    expect(resultado?.medidasComparadas).toEqual(['calibreRealMm', 'alturaMaximaMm', 'massaGramas']);
  });

  it('redistribui pesos com referência sem altura, permitindo primeira posição parcial', () => {
    const resultados = consultarProjeteis([referencia('completa-distante', { massaGramas: 11 }), referencia('parcial', { alturaMinMm: null, alturaMaxMm: null })], consulta);
    expect(resultados[0]?.projetil.id).toBe('parcial');
    expect(resultados[0]?.pontuacao).toBe(0);
    expect(resultados[0]?.medidasAusentes).toEqual(['alturaMaximaMm']);
    const [parcial] = consultarProjeteis([referencia('a', { massaGramas: 11, alturaMinMm: null, alturaMaxMm: null })], consulta);
    expect(parcial?.pontuacao).toBeCloseTo(0.075);
  });

  it('coloca ausência da principal depois e não a trata como erro zero', () => {
    expect(ids([referencia('sem-massa', { massaGramas: null }), referencia('com-massa', { massaGramas: 15 })])).toEqual(['com-massa', 'sem-massa']);
  });

  it('favorece maior cobertura somente no desempate da pontuação', () => {
    expect(ids([referencia('a-parcial', { alturaMinMm: null, alturaMaxMm: null }), referencia('z-completa')])).toEqual(['z-completa', 'a-parcial']);
  });

  it('redistribui pesos quando a prioridade não foi informada e permite uma única medida', () => {
    const [resultado] = consultarProjeteis([referencia('a', { calibreRealMinMm: 11, calibreRealMaxMm: 11 })], { ...consulta, massaGramas: null });
    expect(resultado?.pontuacao).toBeCloseTo(0.05);
    expect(resultado?.prioridadeAusente).toBe(false);
    const [unica] = consultarProjeteis([referencia('b', { massaGramas: 11 })], { ...consulta, calibreRealMm: null, alturaMaximaMm: null });
    expect(unica?.pontuacao).toBeCloseTo(0.1);
  });

  it('usa faixas e diferenças assinadas corretamente', () => {
    const faixa = referencia('faixa', { calibreRealMinMm: 9, calibreRealMaxMm: 11 });
    expect(consultarProjeteis([faixa], consulta)[0]?.calibreReal.diferenca).toBe(0);
    expect(consultarProjeteis([faixa], { ...consulta, calibreRealMm: 8 })[0]?.calibreReal.diferenca).toBe(-1);
    expect(consultarProjeteis([faixa], { ...consulta, calibreRealMm: 12 })[0]?.calibreReal.diferenca).toBe(1);
  });

  it('na perda de material, agrupa massa sem premiar referência mais próxima da massa restante', () => {
    const resultados = consultarProjeteis([
      referencia('c-inferior', { massaGramas: 5 }), referencia('b-igual', { massaGramas: 6 }),
      referencia('a-superior', { massaGramas: 20 }), referencia('d-desconhecida', { massaGramas: null }),
    ], { ...consulta, massaGramas: 6, calibreRealMm: null, alturaMaximaMm: null, perdaMaterial: true });
    expect(resultados.map(item => item.projetil.id)).toEqual(['a-superior', 'b-igual', 'd-desconhecida', 'c-inferior']);
    expect(resultados.every(item => item.pontuacao === null && !item.massa.utilizada && !item.prioridadeAusente)).toBe(true);
  });

  it('na perda de material, ordena pelas dimensões com pesos redistribuídos', () => {
    const resultados = consultarProjeteis([referencia('massa-igual', { calibreRealMinMm: 12, calibreRealMaxMm: 12 }), referencia('dimensoes-proximas', { massaGramas: 20 })], { ...consulta, perdaMaterial: true });
    expect(resultados[0]?.projetil.id).toBe('dimensoes-proximas');
    expect(resultados[1]?.pontuacao).toBeCloseTo(0.1);
    expect(resultados[0]?.medidasComparadas).not.toContain('massaGramas');
  });

  it('sem massa observada, a perda não cria grupos nem pontua a massa', () => {
    const resultados = consultarProjeteis([referencia('a', { massaGramas: null })], { ...consulta, massaGramas: null, perdaMaterial: true });
    expect(resultados[0]?.grupoMassa).toBe(0);
    expect(resultados[0]?.pontuacao).toBe(0);
  });

  it('filtra só por formato e mantém desempate estável sem proximidade', () => {
    const resultados = consultarProjeteis([referencia('z'), referencia('outro', { sigla: 'EXPO' }), referencia('a')], { ...consulta, calibreRealMm: null, alturaMaximaMm: null, massaGramas: null, sigla: 'ETOG' });
    expect(resultados.map(item => item.projetil.id)).toEqual(['a', 'z']);
    expect(resultados.every(item => item.pontuacao === null)).toBe(true);
  });

  it('exclui dados suspeitos da consulta sem remover o registro original', () => {
    const suspeito = referencia('suspeito', { motivoExclusaoClassificacao: 'Em revisão' });
    expect(ids([suspeito, referencia('valido')])).toEqual(['valido']);
    expect(suspeito.massaGramas).toBe(10);
  });

  it('classifica o .38 Curto CHOG em primeiro no exemplo conferido na tabela original', () => {
    const [primeiro] = consultarProjeteis(catalogoProjeteis, {
      ...consulta, calibreRealMm: 9, alturaMaximaMm: 17.39, massaGramas: 5.7,
    });
    expect(primeiro?.projetil.id).toBe('pdf-012');
    expect(primeiro?.medidasComparadas).toEqual(['calibreRealMm', 'alturaMaximaMm', 'massaGramas']);
    expect(primeiro?.medidasAusentes).toEqual([]);
    expect(primeiro?.massa.diferenca).toBeCloseTo(-0.002);
    expect(primeiro?.pontuacao).toBeCloseTo(0.00021052631578945, 12);
  });

  it('classifica o balote em primeiro com desvio zero usando os gramas publicados', () => {
    const [primeiro] = consultarProjeteis(catalogoProjeteis, {
      ...consulta, calibreRealMm: 17.5, alturaMaximaMm: null, massaGramas: 24.8,
    });
    expect(primeiro?.projetil.id).toBe('baruch-4-09');
    expect(primeiro?.medidasComparadas).toEqual(['calibreRealMm', 'massaGramas']);
    expect(primeiro?.calibreReal.diferenca).toBe(0);
    expect(primeiro?.massa.diferenca).toBe(0);
    expect(primeiro?.pontuacao).toBe(0);
  });

  it('inclui as cinco referências revistas mesmo quando há ressalvas na observação', () => {
    const resultados = ids(catalogoProjeteis);
    for (const id of ['pdf-004', 'pdf-010', 'pdf-012', 'baruch-4-07', 'baruch-4-09']) {
      expect(resultados).toContain(id);
    }
  });

  it.each([0, -1, NaN, Infinity])('não produz pontuação inválida para medida %s', valor => {
    const [resultado] = consultarProjeteis([referencia('a')], { ...consulta, massaGramas: valor, calibreRealMm: null, alturaMaximaMm: null });
    expect(resultado?.pontuacao).toBeNull();
    expect(resultado?.medidasComparadas).toEqual([]);
  });

  it('separa uma referência sem nenhuma medida comparável de uma comparação parcial', () => {
    const resultados = consultarProjeteis([referencia('a-vazia', { massaGramas: null, calibreRealMinMm: null, calibreRealMaxMm: null, alturaMinMm: null, alturaMaxMm: null }), referencia('b-parcial', { massaGramas: null })], consulta);
    expect(resultados.map(item => item.projetil.id)).toEqual(['b-parcial', 'a-vazia']);
    expect(resultados[1]?.pontuacao).toBeNull();
  });
});
