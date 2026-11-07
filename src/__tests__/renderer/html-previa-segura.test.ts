import { describe, expect, it } from 'vitest';
import { prepararHtmlPreviaSeguro } from '@/lib/html-previa-segura';

describe('prepararHtmlPreviaSeguro', () => {
  it('preserva formatação e remove elementos e atributos ativos', () => {
    const html = prepararHtmlPreviaSeguro('<p class="texto"><strong>Seguro</strong></p><img src=x onerror="alert(1)"><script>alert(1)</script>');
    expect(html).toContain('<strong>Seguro</strong>');
    expect(html).not.toMatch(/script|onerror|src=/i);
  });
});
