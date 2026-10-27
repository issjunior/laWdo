import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolverImagensImpressaoLaudo } from '@/lib/imagens-impressao-laudo';

const margens = { top: 2, right: 2, bottom: 2, left: 2 };
const previa = 'data:image/jpeg;base64,cHJldmlh';
const fonte = 'data:image/jpeg;base64,b3JpZ2luYWw=';
const obterImagemImpressao = vi.fn();
const ipcApiOriginal = window.ipcAPI;

function configurarFonte() {
  window.ipcAPI = { ...ipcApiOriginal, ilustracoes: { ...ipcApiOriginal.ilustracoes, obterImagemImpressao } };
}

afterEach(() => {
  window.ipcAPI = ipcApiOriginal;
  obterImagemImpressao.mockReset();
});

describe('resolverImagensImpressaoLaudo', () => {
  it('substitui prévias repetidas pela fonte local e retira a marca de prévia', async () => {
    configurarFonte();
    obterImagemImpressao.mockResolvedValue({ success: true, data: { id: 'foto-1', dataUri: fonte } });
    const html = `<figure class="laudo-figure" data-image-id="foto-1" data-imagem-previa="true"><img src="${previa}"></figure>`.repeat(2);

    const resultado = await resolverImagensImpressaoLaudo(html, 'laudo-1', margens);

    expect(obterImagemImpressao).toHaveBeenCalledOnce();
    expect(obterImagemImpressao).toHaveBeenCalledWith('laudo-1', 'foto-1', expect.any(Number));
    expect(resultado).not.toContain('data-imagem-previa');
    expect(resultado).not.toContain(previa);
    expect(resultado.match(new RegExp(fonte, 'g'))).toHaveLength(2);
  });

  it('interrompe a impressão quando o arquivo fonte não está disponível', async () => {
    configurarFonte();
    obterImagemImpressao.mockResolvedValue({ success: false, error: 'Arquivo local não encontrado' });
    const html = `<figure class="laudo-figure" data-image-id="foto-1" data-imagem-previa="true"><img src="${previa}"></figure>`;

    await expect(resolverImagensImpressaoLaudo(html, 'laudo-1', margens)).rejects.toThrow('Arquivo local não encontrado');
  });

  it('preserva HTML legado sem prévias', async () => {
    const html = `<figure class="laudo-figure"><img src="${fonte}"></figure>`;
    expect(await resolverImagensImpressaoLaudo(html, 'laudo-1', margens)).toBe(html);
  });
});
