import { describe, expect, it } from 'vitest';
import { cacheListagemDesativadaDisponivel } from '@shared/gdl/listagem';

describe('exibição do cache com a listagem GDL desativada', () => {
  const agora = Date.parse('2026-10-07T12:00:00.000Z');

  it('permite cache de 29 minutos e bloqueia ao completar 30 minutos', () => {
    expect(cacheListagemDesativadaDisponivel(new Date(agora - 29 * 60_000).toISOString(), agora)).toBe(true);
    expect(cacheListagemDesativadaDisponivel(new Date(agora - 30 * 60_000).toISOString(), agora)).toBe(false);
  });

  it('recusa datas inválidas ou futuras', () => {
    expect(cacheListagemDesativadaDisponivel('invalida', agora)).toBe(false);
    expect(cacheListagemDesativadaDisponivel(new Date(agora + 1).toISOString(), agora)).toBe(false);
  });
});
