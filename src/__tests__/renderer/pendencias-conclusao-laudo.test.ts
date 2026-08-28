import { describe, expect, it } from 'vitest';
import { identificarPendenciasConclusaoLaudo, possuiPendenciasConclusaoLaudo } from '@/lib/pendencias-conclusao-laudo';

describe('pendências para conclusão do laudo', () => {
  it('conta campos reservados e XXX legado sem duplicar o campo marcado', () => {
    const pendencias = identificarPendenciasConclusaoLaudo(
      '<h2 data-estrutura-nivel="2">1. Material</h2><p><span data-reservado="true">XXX</span> e xxx</p><p><span data-reservado="true">Preenchido</span></p>',
    );

    expect(pendencias).toEqual({
      camposReservados: 2,
      figurasDummy: 0,
      secoes: [{ titulo: '1. Material', camposReservados: 2, figurasDummy: 0 }],
    });
  });

  it('ignora XXX presente apenas em atributos e marcação não visível', () => {
    const pendencias = identificarPendenciasConclusaoLaudo(
      '<p data-exemplo="XXX">Conteúdo real</p><img alt="XXX"><script>const campo = "XXX";</script><style>.xxx { color: red; }</style>',
    );

    expect(pendencias).toEqual({ camposReservados: 0, figurasDummy: 0, secoes: [] });
  });

  it('conta exclusivamente figuras marcadas como dummy', () => {
    const pendencias = identificarPendenciasConclusaoLaudo(
      '<figure class="laudo-figure" data-dummy="true"></figure><figure class="laudo-figure"></figure><p>Figura dummy</p>',
    );

    expect(pendencias).toEqual({
      camposReservados: 0,
      figurasDummy: 1,
      secoes: [{ titulo: '1. Conteúdo', camposReservados: 0, figurasDummy: 1 }],
    });
    expect(possuiPendenciasConclusaoLaudo(pendencias)).toBe(true);
    expect(possuiPendenciasConclusaoLaudo({ camposReservados: 0, figurasDummy: 0, secoes: [] })).toBe(false);
  });

  it('agrupa pendências encontradas em seções diferentes', () => {
    const pendencias = identificarPendenciasConclusaoLaudo(
      '<h2 data-estrutura-nivel="2">1. Exame</h2><p>XXX</p><h2 data-estrutura-nivel="2">2. Ilustrações</h2><figure class="laudo-figure" data-dummy="true"></figure>',
    );

    expect(pendencias.secoes).toEqual([
      { titulo: '1. Exame', camposReservados: 1, figurasDummy: 0 },
      { titulo: '2. Ilustrações', camposReservados: 0, figurasDummy: 1 },
    ]);
  });
});
