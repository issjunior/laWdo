import type { MargensExportacao } from '@shared/types/exportacao.types';

export async function resolverImagensImpressaoLaudo(html: string, laudoId: string, margens: MargensExportacao): Promise<string> {
  if (!html.includes('data-imagem-previa')) return html;
  const larguraMaxima = Math.max(1, Math.min(3000, Math.ceil((21 - margens.left - margens.right) / 2.54 * 300)));
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const figuras = Array.from(documento.querySelectorAll<HTMLElement>('.laudo-figure[data-imagem-previa="true"]'));
  const fontes = new Map<string, string>();
  for (const figura of figuras) {
    if (figura.getAttribute('data-dummy') === 'true') continue;
    const imagemId = figura.getAttribute('data-image-id');
    const imagem = figura.querySelector('img');
    if (!imagemId || !imagem) throw new Error('Figura sem identificação ou imagem para impressão.');
    let fonte = fontes.get(imagemId);
    if (!fonte) {
      const resposta = await window.ipcAPI.ilustracoes.obterImagemImpressao(laudoId, imagemId, larguraMaxima);
      const dados = resposta.data;
      if (!resposta.success || !dados || dados.id !== imagemId || !/^data:image\/(?:jpeg|png|gif|bmp|webp);base64,/i.test(dados.dataUri)) {
        throw new Error(resposta.error || `Arquivo local da figura ${imagemId} indisponível para impressão.`);
      }
      fonte = dados.dataUri;
      fontes.set(imagemId, fonte);
    }
    imagem.setAttribute('src', fonte);
    figura.removeAttribute('data-imagem-previa');
  }
  return documento.body.innerHTML;
}
