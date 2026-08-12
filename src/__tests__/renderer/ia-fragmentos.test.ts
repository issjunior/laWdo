import { describe, expect, it } from 'vitest';
import { protegerFragmentosIa, restaurarFragmentosIa } from '@/lib/ia-fragmentos';

describe('ia-fragmentos', () => {
  it('protege e restaura placeholders, números, datas, IDs e URLs', () => {
    const origem = [{ id: 'texto-0', texto: 'REP 190/2026, em 30/07/2026, registrou 12 itens em https://exemplo.test/{{chave}}.' }];
    const protecao = protegerFragmentosIa(origem);

    expect(protecao.fragmentos[0].texto).not.toContain('190/2026');
    expect(protecao.fragmentos[0].texto).not.toContain('{{chave}}');

    const restaurado = restaurarFragmentosIa(
      [{ id: 'texto-0', texto: `Texto revisado: ${protecao.fragmentos[0].texto}` }],
      protecao,
    );

    expect(restaurado).toEqual([{ id: 'texto-0', texto: `Texto revisado: ${origem[0].texto}` }]);
  });

  it('rejeita resposta que remove, duplica ou inventa token protegido', () => {
    const protecao = protegerFragmentosIa([{ id: 'texto-0', texto: 'Data 30/07/2026.' }]);
    const [token] = protecao.tokensPorFragmento['texto-0'];

    expect(restaurarFragmentosIa([{ id: 'texto-0', texto: 'Data revisada.' }], protecao)).toBeNull();
    expect(restaurarFragmentosIa([{ id: 'texto-0', texto: `${token} ${token}` }], protecao)).toBeNull();
    expect(restaurarFragmentosIa([{ id: 'texto-0', texto: '[[DADO_PROTEGIDO_9999]]' }], protecao)).toBeNull();
  });
});
