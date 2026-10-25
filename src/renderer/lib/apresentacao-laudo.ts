import {
  CHAVE_CABECALHO_DOCUMENTO, CHAVE_FECHAMENTO_LAUDO, FECHAMENTO_DESATIVADO,
  esquemaCabecalhoLaudo, esquemaFechamentoLaudo, type ApresentacaoLaudo, type FechamentoLaudo,
} from '@shared/configuracoes/apresentacao-laudo';
import { obterFormasPerito } from '@shared/utils/perito-tratamento';
import { normalizarRotuloCabecalho } from '@shared/configuracoes/cabecalhos-padrao';
import { lerUsuarioSessao } from './usuario-sessao';

async function obterTextoConfiguracao(chave: string): Promise<string | null> {
  const resposta = await window.ipcAPI.configuracao.obter(chave);
  if (!resposta.success || (resposta.data != null && typeof resposta.data !== 'string')) throw new Error('Não foi possível carregar a apresentação dos laudos.');
  return resposta.data ?? null;
}

export async function carregarApresentacaoPadrao(): Promise<ApresentacaoLaudo> {
  const [cabecalhoJson, fechamentoJson] = await Promise.all([
    obterTextoConfiguracao(CHAVE_CABECALHO_DOCUMENTO), obterTextoConfiguracao(CHAVE_FECHAMENTO_LAUDO),
  ]);
  const cabecalho = cabecalhoJson !== null ? esquemaCabecalhoLaudo.parse(JSON.parse(cabecalhoJson)) : {
    primeiraPaginaHabilitada: true,
    todasPaginasHabilitadas: true,
    primeiraPagina: await obterTextoConfiguracao('cabecalho_laudo') ?? '',
    todasPaginas: await obterTextoConfiguracao('cabecalho_paginas') ?? '',
  };
  const fechamento = fechamentoJson !== null ? esquemaFechamentoLaudo.parse(JSON.parse(fechamentoJson)) : { ...FECHAMENTO_DESATIVADO };
  const usuario = lerUsuarioSessao();
  const formas = obterFormasPerito(usuario?.cargo || usuario?.role, usuario?.forma_tratamento);
  return {
    versao: 1, cabecalho: { ...cabecalho, todasPaginas: normalizarRotuloCabecalho(cabecalho.todasPaginas) }, fechamento,
    perito: {
      ...formas, perito_nome: usuario?.nome ?? '', 'perito.nome': usuario?.nome ?? '', 'perito.cargo': formas.perito_cargo,
      perito_lotacao: usuario?.lotacao ?? '', 'perito.lotacao': usuario?.lotacao ?? '',
      perito_matricula: usuario?.matricula ?? '', 'perito.matricula': usuario?.matricula ?? '', 'perito.especialidade': usuario?.especialidade ?? '',
    },
  };
}

export function resolverDadosPerito(html: string, valores: Record<string, string>): string {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  documento.querySelectorAll('[data-placeholder]').forEach(elemento => {
    const chave = elemento.getAttribute('data-placeholder')?.match(/^\{\{(.+)\}\}$/)?.[1];
    if (chave && Object.hasOwn(valores, chave)) elemento.replaceWith(documento.createTextNode(valores[chave]));
  });
  const textos: Node[] = [];
  const caminhador = documento.createTreeWalker(documento.body, NodeFilter.SHOW_TEXT);
  while (caminhador.nextNode()) textos.push(caminhador.currentNode);
  textos.forEach(no => {
    no.textContent = no.textContent?.replace(/\{\{([^{}]+)\}\}/g, (original: string, chave: string) => Object.hasOwn(valores, chave) ? valores[chave] : original) ?? '';
  });
  return documento.body.innerHTML;
}

export function montarFechamentoHtml(fechamento: FechamentoLaudo, perito: Record<string, string>): string {
  if (!fechamento.habilitado) return '';
  const conteudo = resolverDadosPerito(fechamento.conteudo, perito);
  const documento = new DOMParser().parseFromString(conteudo, 'text/html');
  if (!documento.body.textContent?.trim() && !documento.body.querySelector('img,table')) return '';
  return `<div data-laudo-fechamento="true" data-espacamento-antes-pt="${fechamento.espacamentoAntesPt}" style="break-inside:avoid;page-break-inside:avoid;padding-top:${fechamento.espacamentoAntesPt}pt;">${conteudo}</div>`;
}
