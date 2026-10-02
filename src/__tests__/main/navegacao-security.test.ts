import { describe, expect, it } from 'vitest';
import { navegacaoAplicacaoPermitida, urlExternaPermitida } from '@main/security/navegacao';

describe('política de navegação do Electron', () => {
  it.each([
    'https://example.com/ajuda',
    'http://localhost:3000/documentacao',
    'mailto:suporte@example.com',
  ])('permite protocolo externo explícito: %s', url => {
    expect(urlExternaPermitida(url)).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:text/html,teste', 'file:///C:/segredo.txt', 'invalida'])('bloqueia URL externa: %s', url => {
    expect(urlExternaPermitida(url)).toBe(false);
  });

  it('limita navegação web à origem de desenvolvimento', () => {
    expect(navegacaoAplicacaoPermitida('http://localhost:3000/#/laudos', 'http://localhost:3000')).toBe(true);
    expect(navegacaoAplicacaoPermitida('https://example.com', 'http://localhost:3000')).toBe(false);
  });

  it('limita file URLs ao mesmo documento da aplicação', () => {
    const app = 'file:///C:/lawdo/out/renderer/index.html';
    expect(navegacaoAplicacaoPermitida(`${app}#/laudos`, app)).toBe(true);
    expect(navegacaoAplicacaoPermitida('file:///C:/segredo.txt', app)).toBe(false);
  });
});
