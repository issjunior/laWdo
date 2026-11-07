import type { MargensExportacao } from '@shared/types/exportacao.types';
import type { FalhaPdf } from '@shared/types/pdf.types';
import { codigoFalhaImagemImpressaoValido, type CodigoFalhaImagemImpressao } from '@shared/types/imagem-laudo.types';
import { centralizarFigurasSozinhasHtml } from './figuras';

export class ErroPreparacaoImagemPdf extends Error {
  readonly falhaPdf: FalhaPdf;

  constructor(motivoImagem: CodigoFalhaImagemImpressao, posicaoImagem: number) {
    super(`Falha ao preparar a figura ${posicaoImagem} para impressão: ${motivoImagem}`);
    this.name = 'ErroPreparacaoImagemPdf';
    this.falhaPdf = { codigo: 'IMAGEM_INDISPONIVEL', etapa: 'recursos', tentarNovamente: true,
      origem: 'corpo', posicaoImagem, motivoImagem };
  }
}

export async function resolverImagensImpressaoLaudo(html: string, laudoId: string, margens: MargensExportacao): Promise<string> {
  html = centralizarFigurasSozinhasHtml(html);
  if (!html.includes('data-imagem-previa')) return html;
  const larguraMaxima = Math.max(1, Math.min(3000, Math.ceil((21 - margens.left - margens.right) / 2.54 * 300)));
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const figuras = Array.from(documento.querySelectorAll<HTMLElement>('.laudo-figure[data-imagem-previa="true"]'));
  const todasFiguras = Array.from(documento.querySelectorAll<HTMLElement>('.laudo-figure:not([data-dummy="true"])'));
  const fontes = new Map<string, string>();
  for (const figura of figuras) {
    if (figura.getAttribute('data-dummy') === 'true') continue;
    const posicaoImagem = todasFiguras.indexOf(figura) + 1;
    const imagemId = figura.getAttribute('data-image-id');
    const imagem = figura.querySelector('img');
    if (!imagemId || !imagem) throw new ErroPreparacaoImagemPdf('ENTRADA_INVALIDA', posicaoImagem);
    let fonte = fontes.get(imagemId);
    if (!fonte) {
      let resposta: Awaited<ReturnType<typeof window.ipcAPI.ilustracoes.obterImagemImpressao>>;
      try {
        resposta = await window.ipcAPI.ilustracoes.obterImagemImpressao(laudoId, imagemId, larguraMaxima);
      } catch {
        throw new ErroPreparacaoImagemPdf('COMUNICACAO_FALHOU', posicaoImagem);
      }
      const dados = resposta.data;
      if (!resposta.success) {
        const codigo = resposta.falhaImagem?.codigo;
        throw new ErroPreparacaoImagemPdf(codigoFalhaImagemImpressaoValido(codigo) ? codigo : 'INDETERMINADA', posicaoImagem);
      }
      if (!dados || dados.id !== imagemId || !/^data:image\/(?:jpeg|png|gif|bmp|webp);base64,/i.test(dados.dataUri))
        throw new ErroPreparacaoImagemPdf('RESPOSTA_INVALIDA', posicaoImagem);
      fonte = dados.dataUri;
      fontes.set(imagemId, fonte);
    }
    imagem.setAttribute('src', fonte);
    figura.removeAttribute('data-imagem-previa');
  }
  return documento.body.innerHTML;
}
