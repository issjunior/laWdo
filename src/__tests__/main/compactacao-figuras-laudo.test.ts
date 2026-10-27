import { describe, expect, it, vi } from 'vitest';
import { compactarFigurasParaEditor } from '../../main/services/laudo.service.js';
import { obterPreviaEditorImagemLaudo } from '../../main/services/imagem-laudo.service.js';

vi.mock('../../main/services/imagem-laudo.service.js', () => ({
  obterPreviaEditorImagemLaudo: vi.fn(),
}));

const obterPrevia = vi.mocked(obterPreviaEditorImagemLaudo);
const fonte = `data:image/jpeg;base64,${'A'.repeat(100)}`;

describe('compactarFigurasParaEditor', () => {
  it('troca a imagem embutida por prévia e conserva figuras fictícias', async () => {
    obterPrevia.mockResolvedValue('data:image/jpeg;base64,cHJldmlh');
    const real = `<figure class="laudo-figure" data-image-id="foto-1"><img src="${fonte}"></figure>`;
    const ficticia = '<figure data-dummy="true"><img src="data:image/svg+xml;base64,PHN2Zz4="></figure>';

    const resultado = await compactarFigurasParaEditor('laudo-1', real + ficticia);

    expect(resultado).toContain('data-imagem-previa="true"');
    expect(resultado).toContain('data:image/jpeg;base64,cHJldmlh');
    expect(resultado).not.toContain(fonte);
    expect(resultado).toContain(ficticia);
    expect(obterPrevia).toHaveBeenCalledWith('laudo-1', 'foto-1');
  });

  it('preserva o conteúdo anterior quando a fonte local não existe', async () => {
    obterPrevia.mockRejectedValue(new Error('Arquivo indisponível'));
    const html = `<figure class="laudo-figure" data-image-id="foto-1"><img src="${fonte}"></figure>`;
    expect(await compactarFigurasParaEditor('laudo-1', html)).toBe(html);
  });
});
