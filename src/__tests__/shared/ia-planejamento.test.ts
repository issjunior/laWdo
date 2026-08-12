import { describe, expect, it } from 'vitest';
import {
  fragmentarParaOrcamentoIa,
  planejarExecucaoIa,
  recomporFragmentosPlanejadosIa,
} from '../../shared/ia-planejamento';

describe('planejamento de execução da IA', () => {
  it('mantém a ordem dos fragmentos ao distribuí-los em lotes', () => {
    const plano = planejarExecucaoIa([
      { id: 'texto-0', texto: 'a'.repeat(60) },
      { id: 'texto-1', texto: 'b'.repeat(60) },
      { id: 'texto-2', texto: 'c'.repeat(10) },
    ], 110);

    expect(plano.totalLotes).toBe(3);
    expect(plano.lotes.flatMap(lote => lote.fragmentos.map(fragmento => fragmento.id)))
      .toEqual(['texto-0', 'texto-1', 'texto-2']);
    expect(plano.chamadasBase).toBe(3);
    expect(plano.limiteMaximoChamadas).toBe(24);
  });

  it('rejeita fragmento que não pode ser processado atomicamente em um lote', () => {
    expect(() => planejarExecucaoIa([{ id: 'texto-0', texto: 'a'.repeat(100) }], 50))
      .toThrow('LIMITE_EXCEDIDO');
  });

  it('subdivide um fragmento extenso e recompõe a resposta na ordem original', () => {
    const originais = [{ id: 'texto-0', texto: 'Primeira frase longa. Segunda frase longa. Terceira frase longa.'.repeat(30) }];
    const planejados = fragmentarParaOrcamentoIa(originais, 512);
    const plano = planejarExecucaoIa(originais, 512);

    expect(planejados.length).toBeGreaterThan(1);
    expect(plano.totalLotes).toBe(planejados.length);
    expect(recomporFragmentosPlanejadosIa(originais, planejados)).toEqual(originais);
  });
});
