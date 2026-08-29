import { parsearSecoesEstruturais } from '@/lib/estrutura-laudo';

export interface PendenciaSecaoConclusaoLaudo {
  titulo: string;
  camposReservados: number;
  figurasDummy: number;
}

export interface PendenciasConclusaoLaudo {
  camposReservados: number;
  figurasDummy: number;
  secoes: PendenciaSecaoConclusaoLaudo[];
}

function contarOcorrenciasXxx(texto: string): number {
  return texto.match(/XXX/gi)?.length ?? 0;
}

function identificarPendenciasNoConteudo(html: string): Omit<PendenciaSecaoConclusaoLaudo, 'titulo'> {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const camposReservados = Array.from(documento.querySelectorAll<HTMLElement>('[data-reservado="true"]'))
    .filter(campo => campo.textContent?.trim().toUpperCase() === 'XXX')
    .length;
  const arvore = documento.createTreeWalker(documento.body, NodeFilter.SHOW_TEXT);
  let camposLegados = 0;

  while (arvore.nextNode()) {
    const texto = arvore.currentNode as Text;
    const elementoPai = texto.parentElement;
    if (!elementoPai || elementoPai.closest('[data-reservado="true"]')) continue;
    if (elementoPai.closest('script, style, template')) continue;
    camposLegados += contarOcorrenciasXxx(texto.textContent ?? '');
  }

  return {
    camposReservados: camposReservados + camposLegados,
    figurasDummy: documento.querySelectorAll('.laudo-figure[data-dummy="true"]').length,
  };
}

export function identificarPendenciasConclusaoLaudo(html: string): PendenciasConclusaoLaudo {
  if (!html) return { camposReservados: 0, figurasDummy: 0, secoes: [] };

  let indiceH2 = 0;
  let indiceH3 = 0;
  const secoes = parsearSecoesEstruturais(html)
    .map(secao => {
      if (secao.nivel === 2) {
        indiceH2 += 1;
        indiceH3 = 0;
      } else {
        indiceH3 += 1;
      }

      const numeracao = secao.nivel === 2 ? `${indiceH2}.` : `${indiceH2}.${indiceH3}`;
      return { titulo: `${numeracao} ${secao.titulo}`, ...identificarPendenciasNoConteudo(secao.conteudo) };
    })
    .filter(secao => secao.camposReservados > 0 || secao.figurasDummy > 0);

  return secoes.reduce<PendenciasConclusaoLaudo>((acumulado, secao) => ({
    camposReservados: acumulado.camposReservados + secao.camposReservados,
    figurasDummy: acumulado.figurasDummy + secao.figurasDummy,
    secoes: [...acumulado.secoes, secao],
  }), { camposReservados: 0, figurasDummy: 0, secoes: [] });
}

export function possuiPendenciasConclusaoLaudo(pendencias: PendenciasConclusaoLaudo): boolean {
  return pendencias.camposReservados > 0 || pendencias.figurasDummy > 0;
}
