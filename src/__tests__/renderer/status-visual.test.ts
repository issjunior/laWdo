import { describe, expect, it } from 'vitest';
import { obterClasseAbaStatusLocal, obterClasseBadgeStatusLocal, obterClasseIndicadorStatusLocal } from '@/lib/status-visual';

describe('paleta visual dos status locais', () => {
  it.each([
    ['Pendente', 'red'],
    ['Em Andamento', 'amber'],
    ['Em andamento', 'amber'],
    ['Concluído', 'emerald'],
    ['Entregue', 'blue'],
  ])('usa %s na família %s em badges, abas e indicadores', (status, cor) => {
    expect(obterClasseBadgeStatusLocal(status)).toContain(`bg-${cor}-100`);
    expect(obterClasseAbaStatusLocal(status)).toContain(`bg-${cor}-500`);
    expect(obterClasseIndicadorStatusLocal(status)).toBe(`bg-${cor}-500`);
  });

  it('usa apresentação neutra para status desconhecido', () => {
    expect(obterClasseBadgeStatusLocal('Cancelado')).toBe('border-border bg-muted text-muted-foreground');
    expect(obterClasseIndicadorStatusLocal('Cancelado')).toBe('bg-muted-foreground/40');
  });
});
