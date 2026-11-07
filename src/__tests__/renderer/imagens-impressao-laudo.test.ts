import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroPreparacaoImagemPdf, resolverImagensImpressaoLaudo } from '@/lib/imagens-impressao-laudo';
import { mensagemFalhaPdf } from '@/lib/falha-pdf';

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
    obterImagemImpressao.mockResolvedValue({ success: false, error: 'caminho privado', falhaImagem: { codigo: 'ARQUIVO_AUSENTE' } });
    const html = `<figure class="laudo-figure"><img src="${fonte}"></figure><figure class="laudo-figure" data-image-id="foto-1" data-imagem-previa="true"><img src="${previa}"></figure>`;

    const erro = await resolverImagensImpressaoLaudo(html, 'laudo-1', margens).catch((falha: unknown) => falha);
    expect(erro).toBeInstanceOf(ErroPreparacaoImagemPdf);
    expect((erro as ErroPreparacaoImagemPdf).falhaPdf).toMatchObject({ codigo: 'IMAGEM_INDISPONIVEL', posicaoImagem: 2, motivoImagem: 'ARQUIVO_AUSENTE' });
    expect(mensagemFalhaPdf((erro as ErroPreparacaoImagemPdf).falhaPdf)).toContain('O arquivo local da figura não foi encontrado');
    expect(JSON.stringify(erro)).not.toContain('caminho privado');
  });

  it('classifica falha de transporte sem expor detalhes da exceção', async () => {
    configurarFonte();
    obterImagemImpressao.mockRejectedValue(new Error('caminho privado'));
    const html = `<figure class="laudo-figure" data-image-id="foto-1" data-imagem-previa="true"><img src="${previa}"></figure>`;
    await expect(resolverImagensImpressaoLaudo(html, 'laudo-1', margens)).rejects.toMatchObject({
      falhaPdf: { motivoImagem: 'COMUNICACAO_FALHOU', posicaoImagem: 1 },
    });
  });

  it('preserva HTML legado sem prévias', async () => {
    const html = `<figure class="laudo-figure"><img src="${fonte}"></figure>`;
    expect(await resolverImagensImpressaoLaudo(html, 'laudo-1', margens)).toBe(html);
  });
});
