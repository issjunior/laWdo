import { describe, expect, it } from 'vitest';
import { validarHtmlSeguro } from '@main/services/html-seguro.service';

describe('validarHtmlSeguro', () => {
  it('aceita a formatação persistível do laudo', () => {
    expect(() => validarHtmlSeguro('<p style="text-align:justify"><strong>Texto</strong><img src="data:image/png;base64,AA==" alt="Figura"></p>', 'Conteúdo')).not.toThrow();
  });

  it('aceita SVG incorporado em figura-guia, mesmo com elementos intermediários', () => {
    const html = '<figure data-dummy="true"><div><img src="data:image/svg+xml;base64,PHN2Zy8+" alt="Figura XX"></div></figure>';

    expect(() => validarHtmlSeguro(html, 'Conteúdo')).not.toThrow();
  });

  it.each([
    '<img src="data:image/svg+xml;base64,PHN2Zy8+" alt="Figura">',
    '<figure data-dummy="true"><img src="https://exemplo.test/imagem.png" alt="Figura"></figure>',
  ])('recusa SVG fora de figura-guia e imagens remotas: %s', html => {
    expect(() => validarHtmlSeguro(html, 'Conteúdo')).toThrow('contém imagem externa não permitida');
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
