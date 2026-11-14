import type { Editor as TinyMceEditorInstance } from 'tinymce';
import type { AjusteVisualParFiguras } from '@shared/figura/enquadramento';
import type { ResultadoInsercaoFiguras } from '@shared/types/imagem-laudo.types';
import { personalizarTabelaPlaceholder } from '@/lib/apresentacao-placeholders';
import type { SecaoEstruturalLaudo } from '@/lib/estrutura-laudo';
import { atualizarNumeroFigura, criarFiguraLaudoHtml, criarFigurasLaudoHtml, definirAjusteVisualParFiguras, definirAlturaParFiguras, obterAjusteVisualParFigura, obterAlturaParFigura, obterAtributosObservadosFiguras, removerOcorrenciaFigura, renumerarFigurasNaRaiz } from './documento';

export async function prepararImagemParaEditor(
  editor: TinyMceEditorInstance,
  laudoId: string | undefined,
  dataUri: string,
  id: string,
  nomeArquivo: string,
): Promise<string> {
  if (!laudoId) return dataUri;
  const estagio = await window.ipcAPI.ilustracoes.estagiarImagem(laudoId, {
    id, nomeArquivo, dataUri, legenda: '', origem: 'local', sequencia: 0,
  });
  if (!estagio.success) throw new Error(estagio.error || 'Não foi possível preparar a imagem.');
  const largura = Math.max(1, editor.getBody()?.clientWidth || 800);
  const preparada = await window.ipcAPI.ilustracoes.prepararInsercao(laudoId, id, largura, largura * 0.75, window.devicePixelRatio || 1);
  if (!preparada.success || !preparada.data) throw new Error(preparada.error || 'Não foi possível gerar a prévia da imagem.');
  return preparada.data.previaDataUri;
}

export function inserirFiguraNaSelecao(
  editor: TinyMceEditorInstance,
  intervalo: Range,
  imagem: { id: string; legenda: string },
  previa: string,
): boolean {
  const corpo = editor.getBody();
  if (!corpo?.contains(intervalo.startContainer) || !corpo.contains(intervalo.endContainer)) return false;
  editor.focus();
  editor.selection.setRng(intervalo);
  const anteriores = new Set(Array.from(corpo.querySelectorAll<HTMLElement>('.laudo-figure[data-figure-id]'), figura => figura.getAttribute('data-figure-id')));
  editor.undoManager.transact(() => editor.insertContent(criarFiguraLaudoHtml(previa, imagem.id, imagem.legenda, { previa: true, quebraFinal: true })));
  return Array.from(corpo.querySelectorAll<HTMLElement>('.laudo-figure[data-figure-id]'))
    .some(figura => !anteriores.has(figura.getAttribute('data-figure-id')) && figura.getAttribute('data-image-id') === imagem.id);
}

export function inserirFigurasEmEditor(
  editor: TinyMceEditorInstance,
  imagens: Array<{ url: string; id: string; legenda: string; previa?: boolean }>,
): { idsAplicados: string[]; falhas: ResultadoInsercaoFiguras['falhas'] } {
  const idsAplicados: string[] = [];
  const falhas: ResultadoInsercaoFiguras['falhas'] = [];
  editor.undoManager.transact(() => {
    editor.selection.select(editor.getBody(), true);
    editor.selection.collapse(false);
    for (const imagem of imagens) {
      const anteriores = new Set(Array.from(editor.getBody().querySelectorAll<HTMLElement>('.laudo-figure[data-figure-id]'), figura => figura.getAttribute('data-figure-id')));
      try {
        editor.execCommand('insertLaudoImage', false, imagem);
        if (Array.from(editor.getBody().querySelectorAll<HTMLElement>('.laudo-figure[data-figure-id]')).some(figura => !anteriores.has(figura.getAttribute('data-figure-id')) && figura.getAttribute('data-image-id') === imagem.id)) idsAplicados.push(imagem.id);
        else falhas.push({ imagemId: imagem.id, mensagem: 'O editor não confirmou a inserção.' });
      } catch (erro: unknown) {
        falhas.push({ imagemId: imagem.id, mensagem: erro instanceof Error ? erro.message : 'Não foi possível inserir a figura.' });
      }
    }
  });
  return { idsAplicados, falhas };
}

export function inserirFigurasDocumentoUnico(
  editor: TinyMceEditorInstance,
  imagens: Array<{ url: string; id: string; legenda: string; previa?: boolean }>,
  secoesBase: SecaoEstruturalLaudo[],
  dividirSecoes: (html: string, secoes: SecaoEstruturalLaudo[]) => SecaoEstruturalLaudo[],
  montarDocumento: (secoes: SecaoEstruturalLaudo[]) => string,
): { idsAplicados: string[]; html: string; secoes: SecaoEstruturalLaudo[] } {
  const secoes = [...dividirSecoes(editor.getContent(), secoesBase)];
  let indice = secoes.findIndex(secao => secao.titulo.trim().toUpperCase() === 'ILUSTRAÇÕES');
  if (indice < 0) {
    indice = secoes.findIndex(secao => ['CONSIDERAÇÕES FINAIS', 'ENCERRAMENTO', 'CONCLUSÃO'].includes(secao.titulo.trim().toUpperCase()));
    if (indice < 0) indice = secoes.length;
    secoes.splice(indice, 0, { nivel: 2, titulo: 'ILUSTRAÇÕES', conteudo: '<p>&nbsp;</p>' });
  }
  const secao = secoes[indice];
  secoes[indice] = { ...secao, conteudo: (secao.conteudo === '<p>&nbsp;</p>' ? '' : secao.conteudo) + criarFigurasLaudoHtml(imagens) };
  const anteriores = new Set(Array.from(editor.getBody().querySelectorAll<HTMLElement>('.laudo-figure[data-figure-id]'), figura => figura.getAttribute('data-figure-id')));
  editor.undoManager.transact(() => editor.setContent(montarDocumento(secoes)));
  const novas = Array.from(editor.getBody().querySelectorAll<HTMLElement>('.laudo-figure[data-figure-id]'))
    .filter(figura => !anteriores.has(figura.getAttribute('data-figure-id')));
  const idsAplicados = imagens.filter(imagem => novas.some(figura => figura.getAttribute('data-image-id') === imagem.id)).map(imagem => imagem.id);
  return { idsAplicados, html: editor.getContent(), secoes };
}

export function removerFiguraComNumeracao(
  raiz: HTMLElement,
  figura: HTMLElement,
  quantidadeAnterior: number,
  editor: TinyMceEditorInstance | null,
  aposRemocao?: () => void,
): boolean {
  if (!raiz.contains(figura)) return false;
  const remover = () => {
    const previa = figura.closest<HTMLElement>('[data-placeholder-preview="true"]');
    if (previa && (!editor || previa.getAttribute('data-placeholder-preview-tabela') !== 'true'
      || !personalizarTabelaPlaceholder(editor, previa))) return;
    if (editor) editor.execCommand('removeLaudoImage', false, { id: figura.getAttribute('data-image-id'), figureElement: figura });
    else removerOcorrenciaFigura(raiz, figura);
    if (raiz.contains(figura)) return;
    renumerarFigurasNaRaiz(raiz, quantidadeAnterior);
    aposRemocao?.();
  };
  if (editor) editor.undoManager.transact(remover);
  else remover();
  return !raiz.contains(figura);
}

export function localizarFiguraImagemSelecionada(editor: TinyMceEditorInstance): HTMLElement | null {
  let imagem: Element | null = editor.selection.getNode();
  if (imagem.tagName !== 'IMG') {
    const intervalo = editor.selection.getRng();
    if (intervalo.collapsed || intervalo.startContainer !== intervalo.endContainer || intervalo.endOffset !== intervalo.startOffset + 1) return null;
    const selecionado = intervalo.startContainer.childNodes[intervalo.startOffset];
    imagem = selecionado?.nodeType === 1 && (selecionado as Element).tagName === 'IMG' ? selecionado as Element : null;
  }
  return imagem?.closest<HTMLElement>('figure.laudo-figure[data-image-id][data-figure-id]') ?? null;
}

export function obterFiguraEmProcessamento(editor: TinyMceEditorInstance, ocorrenciaId: string, imagemId: string): HTMLElement | null {
  if (editor.removed || editor.destroyed) return null;
  const raiz = editor.getBody();
  if (!raiz) return null;
  return Array.from(raiz.querySelectorAll<HTMLElement>('.laudo-figure[data-figure-id][data-imagem-processando="true"]'))
    .find(figura => figura.getAttribute('data-figure-id') === ocorrenciaId
      && figura.getAttribute('data-image-id') === imagemId && Boolean(figura.querySelector('img'))) ?? null;
}

export function aplicarAjustePar(
  figura: HTMLElement,
  editor: TinyMceEditorInstance | null,
  ajuste: { tipo: 'altura'; valor: number } | { tipo: 'visual'; valor: AjusteVisualParFiguras },
): { confirmou: boolean; alterou: boolean } {
  if (ajuste.tipo === 'altura') {
    const anterior = obterAlturaParFigura(figura);
    if (anterior === undefined) return { confirmou: false, alterou: false };
    if (editor) editor.execCommand('confirmarAlturaParFiguras', false, { figureElement: figura, alturaPercentual: ajuste.valor });
    else definirAlturaParFiguras(figura, ajuste.valor);
    const atual = obterAlturaParFigura(figura);
    return { confirmou: atual === ajuste.valor, alterou: atual !== anterior };
  }
  const anterior = obterAjusteVisualParFigura(figura);
  if (anterior === undefined) return { confirmou: false, alterou: false };
  if (editor) editor.execCommand('definirAjusteVisualParFiguras', false, { figureElement: figura, ajusteVisual: ajuste.valor });
  else definirAjusteVisualParFiguras(figura, ajuste.valor);
  const atual = obterAjusteVisualParFigura(figura);
  return { confirmou: atual === ajuste.valor, alterou: atual !== anterior };
}

export function localizarFiguraPorIndice(editores: TinyMceEditorInstance[], indice: number): { editor: TinyMceEditorInstance; figura: HTMLElement } | null {
  if (!Number.isInteger(indice) || indice < 0) return null;
  const figuras = editores.flatMap(editor => Array.from(editor.getBody()?.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]') || [])
    .map(figura => ({ editor, figura })));
  return figuras[indice] || null;
}

export function renumerarFigurasNosEditores(editores: TinyMceEditorInstance[]): boolean {
  let numero = 0;
  let alterou = false;
  for (const editor of editores) {
    for (const figura of editor.getBody()?.querySelectorAll<HTMLElement>('.laudo-figure') || []) {
      numero += 1;
      if (atualizarNumeroFigura(figura, numero)) alterou = true;
    }
  }
  return alterou;
}

export function renumerarFigurasNasSecoes(fontes: Array<{ editor: TinyMceEditorInstance | null; html: string }>): Array<string | null> {
  let numero = 0;
  return fontes.map(({ editor, html }) => {
    const raiz = editor?.getBody() || (html.includes('laudo-figure') ? new DOMParser().parseFromString(html, 'text/html').body : null);
    if (!raiz) return null;
    let alterou = false;
    for (const figura of raiz.querySelectorAll<HTMLElement>('.laudo-figure')) {
      numero += 1;
      if (atualizarNumeroFigura(figura, numero)) alterou = true;
    }
    return alterou ? (editor ? editor.getContent() : raiz.innerHTML) : null;
  });
}

export function observarEstruturaFiguras(editor: TinyMceEditorInstance, aoAlterar: () => void): void {
  const raiz = editor.getBody();
  if (!raiz) return;
  const contemFigura = (no: Node) => no.nodeType === 1 && (
    (no as Element).matches('.laudo-figure, figcaption')
    || Boolean((no as Element).querySelector('.laudo-figure, figcaption'))
  );
  const observador = new MutationObserver(mudancas => {
    if (mudancas.some(mudanca => {
      const elemento = mudanca.target.nodeType === 1 ? mudanca.target as Element : mudanca.target.parentElement;
      return Boolean(elemento?.closest('figcaption'))
        || (mudanca.type === 'attributes' && Boolean(elemento?.closest('.laudo-figure')))
        || Array.from(mudanca.addedNodes).some(contemFigura)
        || Array.from(mudanca.removedNodes).some(contemFigura);
    })) aoAlterar();
  });
  observador.observe(raiz, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: obterAtributosObservadosFiguras(),
  });
  editor.on('remove', () => observador.disconnect());
}

