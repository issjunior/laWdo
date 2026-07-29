import { describe, expect, it } from 'vitest';
import { descreverPlaceholderPendente } from '../../renderer/lib/placeholder-pendente';

describe('descreverPlaceholderPendente', () => {
  it('informa o campo e a letra da arma para placeholders B-602 indexados', () => {
    expect(descreverPlaceholderPendente(
      'b602_arma_2_modelo',
      [],
      { b602_arma_2_letra: { valor: 'B' } },
    )).toBe('Campo pendente na REP: Modelo da Arma — Arma B');
  });

  it('usa o rótulo do catálogo sem contexto de arma para campos gerais', () => {
    expect(descreverPlaceholderPendente('b602_numero_bo', [], {}))
      .toBe('Campo pendente na REP: Nº BO');
  });

  it('usa a descrição do placeholder personalizado e a chave como último fallback', () => {
    expect(descreverPlaceholderPendente('delegacia', [{ chave: 'delegacia', descricao: 'Delegacia responsável' }], {}))
      .toBe('Campo pendente na REP: Delegacia responsável');
    expect(descreverPlaceholderPendente('campo_desconhecido', [], {}))
      .toBe('Campo pendente na REP: campo_desconhecido');
  });
});
