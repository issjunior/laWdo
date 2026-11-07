import { describe, expect, it } from 'vitest';
import { validarHtmlSeguro } from '@main/services/html-seguro.service';

describe('validarHtmlSeguro', () => {
  it('aceita a formatação persistível do laudo', () => {
    expect(() => validarHtmlSeguro('<p style="text-align:justify"><strong>Texto</strong><img src="data:image/png;base64,AA==" alt="Figura"></p>', 'Conteúdo')).not.toThrow();
  });

  it.each([
    '<img src=x onerror="window.ipcAPI.peca.delete(\'1\')">',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)">link</a>',
    '<p style="background:url(https://exemplo.test/a)">texto</p>',
  ])('recusa HTML ativo: %s', html => {
    expect(() => validarHtmlSeguro(html, 'Conteúdo')).toThrow(/não permitid/);
  });
});
