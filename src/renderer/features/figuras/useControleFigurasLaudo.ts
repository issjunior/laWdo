import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { Editor } from 'tinymce';
import type { ImagemLaudo } from './tipos';
import { extrairFigurasDaRaiz, extrairFigurasDoHtml } from './extracao';
import { atualizarLegendaOcorrencia, substituirImagemOcorrencia } from './documento';
import { personalizarTabelaPlaceholder } from '@/lib/apresentacao-placeholders';
import { aplicarAjustePar, inserirFiguraNaSelecao, inserirFigurasDocumentoUnico, inserirFigurasEmEditor, removerFiguraComNumeracao } from './editor';

interface OpcoesControleFiguras {
  editorMode: 'single' | 'multi';
  singleEditorHtml: string;
  secoes: Array<{ conteudo: string }>;
  secoesAtuaisRef: RefObject<Array<{ conteudo: string }>>;
  sessaoEditor: number;
  obterSessao: () => number;
  sessaoAtual: (sessao: number) => boolean;
  obterEditor: (id: string) => Editor | null;
  editoresFigurasAlteradosRef: RefObject<Set<string>>;
}

export function useControleFigurasLaudo({ editorMode, singleEditorHtml, secoes, secoesAtuaisRef, sessaoEditor, obterSessao, sessaoAtual, obterEditor, editoresFigurasAlteradosRef }: OpcoesControleFiguras) {
  const cacheFigurasRef = useRef<Array<{ html: string; raiz: HTMLElement | null; figuras: ImagemLaudo[] }>>([]);
  const imagensProtegidasRef = useRef(new Set<string>());
  const figurasAnterioresRef = useRef<ImagemLaudo[]>([]);
  const figurasDevolvidasRef = useRef(new Map<string, ImagemLaudo>());
  const modoAnteriorRef = useRef(editorMode);
  const sessaoProtegidaRef = useRef(sessaoEditor);
  const filasOperacoesRef = useRef(new Map<number, Promise<void>>());
  const operacoesPendentesRef = useRef(new Map<number, number>());
  const extrairFigurasDoEditor = useCallback((): ImagemLaudo[] => {
    if (sessaoProtegidaRef.current !== sessaoEditor) {
      imagensProtegidasRef.current.clear();
      figurasAnterioresRef.current = [];
      figurasDevolvidasRef.current.clear();
      modoAnteriorRef.current = editorMode;
      cacheFigurasRef.current = [];
      editoresFigurasAlteradosRef.current.clear();
      sessaoProtegidaRef.current = sessaoEditor;
    }
    const secoesFonte = secoesAtuaisRef.current === secoes ? secoes : secoesAtuaisRef.current;
    const fontes = editorMode === 'single' ? [singleEditorHtml] : secoesFonte.map(secao => secao.conteudo);
    const anteriores = cacheFigurasRef.current;
    cacheFigurasRef.current = fontes.map((html, indice) => {
      const id = editorMode === 'single' ? 'laudo-single-editor' : `secao-${indice}`;
      const raiz = obterEditor(id)?.getBody() ?? null;
      const anterior = anteriores[indice];
      const alterado = editoresFigurasAlteradosRef.current.delete(id);
      if (anterior && anterior.raiz === raiz && !alterado && (raiz || anterior.html === html)) return anterior;
      const figuras = raiz ? extrairFigurasDaRaiz(raiz) : html.includes('laudo-figure') ? extrairFigurasDoHtml(html) : [];
      return { html: raiz ? '' : html, raiz, figuras };
    });
    const figuras = cacheFigurasRef.current.flatMap(item => item.figuras);
    const ocorrenciasAtuais = new Set(figuras.map(figura => figura.ocorrenciaId).filter(Boolean));
    if (modoAnteriorRef.current === editorMode) {
      for (const anterior of figurasAnterioresRef.current) {
        if (!anterior.dummy && anterior.ocorrenciaId && !ocorrenciasAtuais.has(anterior.ocorrenciaId)) {
          figurasDevolvidasRef.current.set(anterior.ocorrenciaId, anterior);
        }
      }
    }
    modoAnteriorRef.current = editorMode;
    for (const ocorrenciaId of figurasDevolvidasRef.current.keys()) {
      if (ocorrenciasAtuais.has(ocorrenciaId)) figurasDevolvidasRef.current.delete(ocorrenciaId);
    }
    figurasAnterioresRef.current = figuras;
    for (const figura of figuras) if (!figura.dummy) imagensProtegidasRef.current.add(figura.id);
    return figuras
      .map((figura, indice) => ({ ...figura, numero_figura: indice + 1, sequencia: indice + 1 }));
  }, [editorMode, singleEditorHtml, secoes, secoesAtuaisRef, obterEditor, editoresFigurasAlteradosRef, sessaoEditor]);

  useEffect(() => {
    cacheFigurasRef.current = [];
    editoresFigurasAlteradosRef.current.clear();
    const filas = filasOperacoesRef.current;
    const pendentes = operacoesPendentesRef.current;
    return () => { filas.delete(sessaoEditor); pendentes.delete(sessaoEditor); };
  }, [sessaoEditor, editoresFigurasAlteradosRef]);

  const obterImagensProtegidas = useCallback(() => {
    if (sessaoProtegidaRef.current !== sessaoEditor) return [];
    return Array.from(imagensProtegidasRef.current);
  }, [sessaoEditor]);
  const obterFigurasDevolvidas = useCallback(() => (
    sessaoProtegidaRef.current === sessaoEditor ? Array.from(figurasDevolvidasRef.current.values()) : []
  ), [sessaoEditor]);
  const consumirFigurasDevolvidas = useCallback((ids: string[]) => {
    const consumidos = new Set(ids);
    for (const [ocorrenciaId, figura] of figurasDevolvidasRef.current) {
      if (consumidos.has(figura.id)) figurasDevolvidasRef.current.delete(ocorrenciaId);
    }
  }, []);
  const iniciarProcessamentoImagem = useCallback((sessao: number) => {
    if (!sessaoAtual(sessao)) return () => {};
    const pendentes = operacoesPendentesRef.current;
    pendentes.set(sessao, (pendentes.get(sessao) || 0) + 1);
    let encerrado = false;
    return () => {
      if (encerrado) return;
      encerrado = true;
      const restantes = (pendentes.get(sessao) || 0) - 1;
      if (restantes > 0) pendentes.set(sessao, restantes);
      else pendentes.delete(sessao);
    };
  }, [sessaoAtual]);
  const haOperacoesPendentes = useCallback(() => (operacoesPendentesRef.current.get(obterSessao()) || 0) > 0, [obterSessao]);
  const executarOperacaoFigura = useCallback(<T,>(operacao: () => Promise<T>): Promise<T> => {
    const sessao = obterSessao();
    const finalizar = iniciarProcessamentoImagem(sessao);
    const filas = filasOperacoesRef.current;
    const resultado = (filas.get(sessao) || Promise.resolve()).then(operacao);
    const fimFila = resultado.then(() => undefined, () => undefined);
    filas.set(sessao, fimFila);
    return resultado.finally(() => {
      finalizar();
      if (filas.get(sessao) === fimFila) filas.delete(sessao);
    });
  }, [iniciarProcessamentoImagem, obterSessao]);
  const obterAlvoFigura = useCallback((indice: number, ocorrenciaId?: string): {
    figura: HTMLElement; raiz: HTMLElement; editor: Editor | null; indiceSecao: number | null;
  } | null => {
    if (!ocorrenciaId && (!Number.isInteger(indice) || indice < 0)) return null;
    const fontes = editorMode === 'single'
      ? [{ id: 'laudo-single-editor', html: singleEditorHtml, indiceSecao: null }]
      : secoesAtuaisRef.current.map((secao, indiceSecao) => ({ id: `secao-${indiceSecao}`, html: secao.conteudo, indiceSecao }));
    let posicao = 0;
    for (const fonte of fontes) {
      const editor = obterEditor(fonte.id);
      if (!editor && fonte.indiceSecao === null) return null;
      const raiz = editor?.getBody() || new DOMParser().parseFromString(fonte.html, 'text/html').body;
      for (const figura of raiz.querySelectorAll<HTMLElement>('.laudo-figure')) {
        if (ocorrenciaId ? figura.getAttribute('data-figure-id') === ocorrenciaId : posicao === indice) {
          return { figura, raiz, editor, indiceSecao: fonte.indiceSecao };
        }
        posicao += 1;
      }
    }
    return null;
  }, [editorMode, singleEditorHtml, obterEditor, secoesAtuaisRef]);
  const atualizarLegendaFigura = useCallback((imagemId: string, legenda: string, ocorrenciaId?: string): { indiceSecao: number | null; html: string; alterou: boolean } | null => {
    if (!ocorrenciaId && extrairFigurasDoEditor().filter(figura => figura.id === imagemId).length !== 1) return null;
    const fontes = editorMode === 'single'
      ? [{ id: 'laudo-single-editor', html: singleEditorHtml, indiceSecao: null }]
      : secoesAtuaisRef.current.map((secao, indiceSecao) => ({ id: `secao-${indiceSecao}`, html: secao.conteudo, indiceSecao }));
    for (const fonte of fontes) {
      const editor = obterEditor(fonte.id);
      if (!editor && fonte.indiceSecao === null) return null;
      const raiz = editor?.getBody() || new DOMParser().parseFromString(fonte.html, 'text/html').body;
      const figura = Array.from(raiz.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]'))
        .find(elemento => elemento.getAttribute('data-image-id') === imagemId
          && (!ocorrenciaId || elemento.getAttribute('data-figure-id') === ocorrenciaId)
          && Boolean(elemento.querySelector('figcaption')));
      if (!figura) continue;
      let alterou = false;
      const aplicar = () => { alterou = atualizarLegendaOcorrencia(raiz, imagemId, legenda, ocorrenciaId); };
      if (editor) editor.undoManager.transact(aplicar);
      else aplicar();
      if (alterou && editor) editoresFigurasAlteradosRef.current.add(editor.id);
      return { indiceSecao: fonte.indiceSecao, html: alterou ? (editor ? editor.getContent() : raiz.innerHTML) : '', alterou };
    }
    return null;
  }, [editorMode, singleEditorHtml, secoesAtuaisRef, obterEditor, editoresFigurasAlteradosRef, extrairFigurasDoEditor]);
  const ajustarParFigura = useCallback((indice: number, ocorrenciaId: string | undefined, ajuste: Parameters<typeof aplicarAjustePar>[2]): { indiceSecao: number | null; html: string; alterou: boolean } | null => {
    const alvo = obterAlvoFigura(indice, ocorrenciaId);
    if (!alvo) return null;
    const resultado = aplicarAjustePar(alvo.figura, alvo.editor, ajuste);
    if (!resultado.confirmou) return null;
    if (resultado.alterou && alvo.editor) editoresFigurasAlteradosRef.current.add(alvo.editor.id);
    return {
      indiceSecao: alvo.indiceSecao,
      html: resultado.alterou ? (alvo.editor ? alvo.editor.getContent() : alvo.raiz.innerHTML) : '',
      alterou: resultado.alterou,
    };
  }, [obterAlvoFigura, editoresFigurasAlteradosRef]);
  const removerFiguraDocumentoUnico = useCallback((imagemId: string, indice: number | undefined, ocorrenciaId: string | undefined, aposRemocao?: (secao: HTMLElement | null) => void): string | null => {
    const editor = obterEditor('laudo-single-editor');
    const raiz = editor?.getBody();
    if (!editor || !raiz) return null;
    const figuras = Array.from(raiz.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]'));
    const figura = ocorrenciaId
      ? figuras.find(item => item.getAttribute('data-figure-id') === ocorrenciaId)
      : indice === undefined ? figuras.find(item => item.getAttribute('data-image-id') === imagemId) : figuras[indice];
    if (!figura || figura.getAttribute('data-image-id') !== imagemId) return null;
    const secao = figura.closest<HTMLElement>('section[data-laudo-secao="true"]');
    if (!removerFiguraComNumeracao(raiz, figura, 0, editor, () => aposRemocao?.(secao))) return null;
    editoresFigurasAlteradosRef.current.add(editor.id);
    return editor.getContent();
  }, [obterEditor, editoresFigurasAlteradosRef]);
  const removerFiguraSecao = useCallback((indiceSecao: number, indiceLocal: number, quantidadeAnterior: number, imagemId: string, ocorrenciaId?: string): { anterior: string; atual: string } | null => {
    const secao = secoesAtuaisRef.current[indiceSecao];
    if (!secao) return null;
    const instancia = obterEditor(`secao-${indiceSecao}`);
    const editor = instancia?.getBody() ? instancia : null;
    const anterior = editor?.getContent() || secao.conteudo;
    const raiz = editor?.getBody() || new DOMParser().parseFromString(anterior, 'text/html').body;
    const figuras = Array.from(raiz.querySelectorAll<HTMLElement>('.laudo-figure[data-image-id]'));
    const figura = ocorrenciaId
      ? figuras.find(item => item.getAttribute('data-figure-id') === ocorrenciaId)
      : figuras[indiceLocal];
    if (!figura || figura.getAttribute('data-image-id') !== imagemId) return null;
    if (!removerFiguraComNumeracao(raiz, figura, quantidadeAnterior, editor)) return null;
    if (editor) editoresFigurasAlteradosRef.current.add(editor.id);
    return { anterior, atual: editor ? editor.getContent() : raiz.innerHTML };
  }, [secoesAtuaisRef, obterEditor, editoresFigurasAlteradosRef]);
  const substituirFigura = useCallback((imagemAnteriorId: string, imagem: ImagemLaudo, previa: string, indice?: number, exigirFiguraReal = false, legenda?: string): { indiceSecao: number | null; html: string } | null => {
    if (!imagem.ocorrenciaId && indice === undefined) {
      const correspondencias = extrairFigurasDoEditor()
        .map((figura, posicao) => figura.id === imagemAnteriorId ? posicao : -1)
        .filter(posicao => posicao >= 0);
      if (correspondencias.length !== 1) return null;
      indice = correspondencias[0];
    }
    const alvo = obterAlvoFigura(indice ?? -1, imagem.ocorrenciaId);
    if (!alvo || alvo.figura.getAttribute('data-image-id') !== imagemAnteriorId
      || (exigirFiguraReal && alvo.figura.getAttribute('data-dummy') === 'true')) return null;
    const ocorrenciaAlvo = alvo.figura.getAttribute('data-figure-id');
    if (legenda !== undefined && (!ocorrenciaAlvo || !alvo.figura.querySelector('figcaption'))) return null;
    const previaTabela = alvo.figura.closest<HTMLElement>('[data-placeholder-preview="true"]');
    if (previaTabela && (!alvo.editor || previaTabela.getAttribute('data-placeholder-preview-tabela') !== 'true')) return null;
    let preservouTabela = !previaTabela;
    const aplicar = () => {
      if (previaTabela && alvo.editor) {
        preservouTabela = personalizarTabelaPlaceholder(alvo.editor, previaTabela);
        if (!preservouTabela) return;
      }
      if (alvo.editor) {
        alvo.editor.execCommand('replaceLaudoImage', false, {
          figureElement: alvo.figura, newImageId: imagem.id, newUrl: previa, imagemOrigemId: imagem.imagemOrigemId, previa: true,
        });
      } else if (!substituirImagemOcorrencia(alvo.raiz, alvo.figura, {
        url: previa, imagemId: imagem.id, imagemOrigemId: imagem.imagemOrigemId, previa: true,
      })) return;
      if (alvo.figura.getAttribute('data-image-id') === imagem.id && legenda !== undefined && ocorrenciaAlvo) {
        atualizarLegendaOcorrencia(alvo.raiz, imagem.id, legenda, ocorrenciaAlvo);
      }
    };
    if (alvo.editor) alvo.editor.undoManager.transact(aplicar);
    else aplicar();
    if (!preservouTabela || alvo.figura.getAttribute('data-image-id') !== imagem.id || alvo.figura.querySelector('img')?.getAttribute('src') !== previa) return null;
    if (legenda !== undefined && alvo.figura.querySelector('figcaption')?.textContent?.replace(/^\s*Fig(?:ura|\.)\s*(?:\d+|XX)\s*:?\s*/i, '').trim() !== legenda.trim()) return null;
    if (alvo.editor) editoresFigurasAlteradosRef.current.add(alvo.editor.id);
    return { indiceSecao: alvo.indiceSecao, html: alvo.editor ? alvo.editor.getContent() : alvo.raiz.innerHTML };
  }, [editoresFigurasAlteradosRef, extrairFigurasDoEditor, obterAlvoFigura]);
  return { extrairFigurasDoEditor, obterAlvoFigura, obterImagensProtegidas, obterFigurasDevolvidas, consumirFigurasDevolvidas, inserirFiguraNaSelecao, inserirFigurasDocumentoUnico, inserirFigurasEmEditor, substituirFigura, atualizarLegendaFigura, ajustarParFigura, removerFiguraDocumentoUnico, removerFiguraSecao, iniciarProcessamentoImagem, haOperacoesPendentes, executarOperacaoFigura };
}
