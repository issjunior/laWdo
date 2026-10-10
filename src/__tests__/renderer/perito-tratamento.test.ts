import { describe, expect, it } from 'vitest';
import { obterFormasPerito } from '../../renderer/lib/perito-tratamento';

describe('formas de tratamento do perito', () => {
  it('resolve título e concordâncias no masculino', () => {
    expect(obterFormasPerito('Perito Oficial Criminal', 'masculino')).toMatchObject({
      perito_cargo: 'Perito Oficial Criminal',
      perito_artigo: 'o',
      perito_titulo: 'Perito',
      perito_designado: 'designado',
      perito_pelo: 'pelo',
      perito_qual: 'o qual',
    });
  });

  it('resolve título e concordâncias no feminino', () => {
    expect(obterFormasPerito('Perito Oficial Criminal', 'feminino')).toMatchObject({
      perito_cargo: 'Perita Oficial Criminal',
      perito_artigo: 'a',
      perito_titulo: 'Perita',
      perito_designado: 'designada',
      perito_pelo: 'pela',
      perito_qual: 'a qual',
    });
    expect(obterFormasPerito('Técnico de Perícia Oficial', 'feminino')).toMatchObject({
      perito_cargo: 'Técnica de Perícia Oficial',
      perito_titulo: 'Técnica',
    });
  });
});
