import { describe, expect, it } from 'vitest';
import { normalizarDataCivil, normalizarDatasCivisRep } from '../../main/utils/data-civil';

describe('data civil da REP', () => {
  it('aceita somente datas gregorianas no formato canônico', () => {
    expect(normalizarDataCivil('2026-02-28', 'prazo')).toBe('2026-02-28');
    expect(normalizarDataCivil('2024-02-29', 'prazo')).toBe('2024-02-29');
    expect(() => normalizarDataCivil('2026-02-29', 'prazo')).toThrow('data inválida');
    expect(() => normalizarDataCivil('28/02/2026', 'prazo')).toThrow('AAAA-MM-DD');
  });

  it('normaliza todas as datas de negócio antes da persistência', () => {
    expect(normalizarDatasCivisRep({
      data_requisicao: '2026-03-01',
      prazo: '',
      data_documento: null,
      observacoes: 'sem alteração',
    })).toEqual({
      data_requisicao: '2026-03-01',
      prazo: null,
      data_documento: null,
      observacoes: 'sem alteração',
    });
  });
});
