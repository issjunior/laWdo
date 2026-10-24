import { describe, expect, it } from 'vitest';
import { criarOpcoesPdf, PIXELS_POR_CM, reservarEspacoCabecalho } from '../../main/services/pdf-layout';

describe('layout do PDF em A4', () => {
  const margens = { top: 4, right: 2, bottom: 2.5, left: 3 };

  it('preserva margens assimétricas e fixa A4 retrato sem preferir tamanho CSS', () => {
    const opcoes = criarOpcoesPdf(margens);
    expect(opcoes).toMatchObject({ pageSize: 'A4', landscape: false, preferCSSPageSize: false });
    for (const chave of ['top', 'right', 'bottom', 'left'] as const) {
      expect(opcoes.margins?.[chave]).toBeCloseTo(margens[chave] / 2.54);
    }
    expect(opcoes.displayHeaderFooter).toBeUndefined();
    expect(opcoes.headerTemplate).toBeUndefined();
  });

  it('posiciona o cabeçalho dentro da área útil e mantém o alinhamento', () => {
    const opcoes = criarOpcoesPdf(margens, '{{ALIGN:flex-end}}<p>FLS. <span class="pageNumber"></span></p>');
    expect(opcoes.headerTemplate).toContain('top: 4cm; left: 3cm;');
    expect(opcoes.headerTemplate).toContain('width: 16cm; box-sizing: border-box;');
    expect(opcoes.headerTemplate).toContain('text-align: right;');
    expect(opcoes.headerTemplate).not.toContain('{{ALIGN:');
    expect(opcoes.headerTemplate).toContain('class="pageNumber"');
  });

  it.each([0.5, 1.75])('reserva a altura medida de %s cm mais 0,3 cm sem alterar o objeto original', altura => {
    const opcoes = criarOpcoesPdf(margens, '<p>Cabeçalho</p>');
    const resultado = reservarEspacoCabecalho(opcoes, altura * PIXELS_POR_CM);
    expect((resultado.margins?.top ?? 0) * 2.54).toBeCloseTo(4 + altura + 0.3);
    expect(resultado.margins).toMatchObject({ left: 3 / 2.54, right: 2 / 2.54, bottom: 2.5 / 2.54 });
    expect(opcoes.margins?.top).toBe(4 / 2.54);
    expect(resultado.headerTemplate).toBe(opcoes.headerTemplate);
  });

  it('não impõe margem superior mínima nem reserva espaço quando não há cabeçalho', () => {
    expect(criarOpcoesPdf({ ...margens, top: 0 }).margins?.top).toBe(0);
    expect(criarOpcoesPdf({ ...margens, top: 1 }, '<p>Cabeçalho</p>').headerTemplate).toContain('top: 1cm');
  });

  it.each([null, NaN, Infinity, -1, '35', 30 * PIXELS_POR_CM])('rejeita altura inválida ou sem espaço útil: %s', altura => {
    expect(() => reservarEspacoCabecalho(criarOpcoesPdf(margens), altura)).toThrow();
  });
});
