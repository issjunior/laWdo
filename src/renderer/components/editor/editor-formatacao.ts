import type { Editor, RawEditorOptions } from 'tinymce';
import { converterMedidaTextoParaPt as converterRecuoParaPt } from '@/lib/medidas-texto';
export { converterMedidaTextoParaPt as converterRecuoParaPt } from '@/lib/medidas-texto';

const SELETOR_PROTEGIDO = '.laudo-figure, figcaption, [data-placeholder], .placeholder-tag, [data-reservado], .campo-reservado, [contenteditable="false"], [data-mce-bogus], [data-mce-type="bookmark"]';
const ESTILOS_TEXTO = ['font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'color', 'background-color', 'vertical-align'];
const ESTILOS_PARAGRAFO = ['margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'line-height'];

export const FORMATOS_LIMPEZA_EDITOR: RawEditorOptions['formats'] = {
  limpezaTextoLaudo: [
    { selector: 'b,strong,em,i,font,u,strike,s,sub,sup,mark,a', remove: 'all', split: true, expand: false, deep: true },
    { selector: 'span', styles: ESTILOS_TEXTO, split: true, expand: false, deep: true },
  ],
  textoPadraoLaudo: {
    inline: 'span',
    styles: {
      'font-family': 'Arial, Helvetica, sans-serif', 'font-size': '14px',
      'font-weight': 'normal', 'font-style': 'normal', 'text-decoration': 'none',
      'vertical-align': 'baseline', 'color': 'var(--cor-texto-editor, #000000)', 'background-color': 'transparent',
    },
  },
};

function elementoProtegido(elemento: Element): boolean {
  return Boolean(elemento.closest(SELETOR_PROTEGIDO));
}

function obterBlocosSelecionados(editor: Editor): HTMLElement[] {
  return editor.selection.getSelectedBlocks().filter((bloco): bloco is HTMLElement =>
    bloco.nodeType === 1 && bloco.matches('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote') && !elementoProtegido(bloco),
  );
}

export const VALORES_ESPACAMENTO_PARAGRAFO = [0, 3, 6, 8, 12, 18, 24] as const;
type LadoEspacamento = 'antes' | 'depois';

function obterParagrafosEspacamento(editor: Editor): HTMLElement[] {
  const blocos = obterBlocosSelecionados(editor).filter(bloco => bloco.matches('p,h1,h2,h3,h4,h5,h6,pre,blockquote'));
  return blocos.filter(bloco => !blocos.some(outro => outro !== bloco && bloco.contains(outro)));
}

export function obterEspacamentoSelecionado(editor: Editor, lado: LadoEspacamento) {
  const propriedade = lado === 'antes' ? 'margin-top' : 'margin-bottom';
  const blocos = obterParagrafosEspacamento(editor);
  const medidas = blocos.map(bloco => converterRecuoParaPt(editor.dom.getStyle(bloco, propriedade, true)));
  const primeira = medidas[0];
  return {
    disponivel: blocos.length > 0,
    padrao: blocos.length > 0 && blocos.every(bloco => !bloco.style.getPropertyValue(propriedade)),
    valorPt: primeira != null && medidas.every(medida => medida !== null && Math.abs(medida - primeira) < 0.1) ? primeira : null,
  };
}

export function aplicarEspacamentoParagrafo(editor: Editor, lado: LadoEspacamento, valorPt?: number): void {
  const blocos = obterParagrafosEspacamento(editor);
  if (!blocos.length || (valorPt !== undefined && !VALORES_ESPACAMENTO_PARAGRAFO.some(valor => valor === valorPt))) return;
  const propriedade = lado === 'antes' ? 'margin-top' : 'margin-bottom';
  const marcador = editor.selection.getBookmark(2, true);
  editor.undoManager.transact(() => {
    for (const bloco of blocos) editor.dom.setStyle(bloco, propriedade, valorPt === undefined ? '' : `${valorPt}pt`);
    editor.selection.moveToBookmark(marcador);
  });
  editor.nodeChanged();
}

export function obterRecuoSelecionado(editor: Editor): number | null {
  const paragrafos = obterBlocosSelecionados(editor).filter(bloco => bloco.matches('p'));
  if (!paragrafos.length) return null;
  const medidas = paragrafos.map(bloco => converterRecuoParaPt(editor.dom.getStyle(bloco, 'text-indent', true)));
  const primeira = medidas[0];
  return primeira !== null && medidas.every(medida => medida !== null && Math.abs(medida - primeira) < 0.1)
    ? primeira : null;
}

export function recuoCorresponde(medida: number | null, valor?: string): boolean {
  const esperado = converterRecuoParaPt(valor || '0');
  return medida !== null && esperado !== null && Math.abs(medida - esperado) < 0.1;
}

export function aplicarRecuoPrimeiraLinha(editor: Editor, valor?: string): void {
  editor.undoManager.transact(() => {
    for (const bloco of obterBlocosSelecionados(editor)) {
      if (bloco.matches('p')) editor.dom.setStyle(bloco, 'text-indent', valor || '0pt');
    }
  });
  editor.nodeChanged();
}

export function limparFormatacaoEditor(editor: Editor): void {
  const blocos = obterBlocosSelecionados(editor);
  if (!blocos.length) return;
  const colapsada = editor.selection.isCollapsed();
  const cursor = editor.selection.getRng();
  const blocosInteiros = new Set(blocos.filter(bloco => {
    if (colapsada) return true;
    const conteudo = editor.getDoc().createRange();
    conteudo.selectNodeContents(bloco);
    return cursor.compareBoundaryPoints(0, conteudo) <= 0 && cursor.compareBoundaryPoints(2, conteudo) >= 0;
  }));
  const antesDoCursor = editor.getDoc().createRange();
  let posicaoCursor = 0;
  if (colapsada) {
    antesDoCursor.selectNodeContents(blocos[0]);
    antesDoCursor.setEnd(cursor.startContainer, cursor.startOffset);
    posicaoCursor = antesDoCursor.toString().length;
  }

  editor.undoManager.transact(() => {
    if (colapsada) editor.selection.select(blocos[0], true);
    const blocosComEstiloHerdado = blocos.filter(bloco => !blocosInteiros.has(bloco)
      && bloco.matches('p,h1,h2,h3,h4,h5,h6,pre')
      && ESTILOS_TEXTO.some(estilo => bloco.style.getPropertyValue(estilo)));
    if (blocosComEstiloHerdado.length) {
      const marcador = editor.selection.getBookmark();
      // Estilos do bloco viram estilos de texto para que a limpeza parcial preserve o restante.
      for (const bloco of blocosComEstiloHerdado) {
        const envoltorio = editor.getDoc().createElement('span');
        for (const estilo of ESTILOS_TEXTO) {
          const valor = bloco.style.getPropertyValue(estilo);
          if (valor) editor.dom.setStyle(envoltorio, estilo, valor);
          editor.dom.setStyle(bloco, estilo, '');
        }
        while (bloco.firstChild) envoltorio.append(bloco.firstChild);
        bloco.append(envoltorio);
      }
      editor.selection.moveToBookmark(marcador);
    }
    const marcadorLimpeza = editor.selection.getBookmark();
    const selecao = editor.selection.getRng();
    const segmentos: Range[] = [];
    const textos = editor.getDoc().createTreeWalker(editor.getBody(), 4);
    while (textos.nextNode()) {
      const texto = textos.currentNode as Text;
      if (!texto.parentElement || elementoProtegido(texto.parentElement) || !selecao.intersectsNode(texto)) continue;
      const inicio = texto === selecao.startContainer ? selecao.startOffset : 0;
      const fim = texto === selecao.endContainer ? selecao.endOffset : texto.length;
      if (inicio >= fim) continue;
      const segmento = editor.getDoc().createRange();
      segmento.setStart(texto, inicio);
      segmento.setEnd(texto, fim);
      segmentos.push(segmento);
    }

    // Trabalhar do fim para o início mantém as seleções restantes válidas ao dividir spans.
    for (const segmento of segmentos.reverse()) {
      editor.selection.setRng(segmento);
      editor.formatter.remove('limpezaTextoLaudo');
      editor.formatter.apply('textoPadraoLaudo');
    }

    for (const bloco of blocos) {
      if (blocosInteiros.has(bloco)) {
        editor.dom.setStyles(bloco, Object.fromEntries(ESTILOS_TEXTO.map(estilo => [estilo, ''])));
      }
      editor.dom.setStyles(bloco, Object.fromEntries(ESTILOS_PARAGRAFO.map(estilo => [estilo, ''])));
      editor.dom.setStyles(bloco, {
        'font-family': 'Arial, Helvetica, sans-serif', 'font-size': '14px',
        'text-align': 'justify', 'text-indent': '0pt',
      });
    }
    editor.selection.moveToBookmark(marcadorLimpeza);
    if (colapsada) {
      const involucros = Array.from(blocos[0].querySelectorAll('b,strong,em,i,font,u,strike,s,sub,sup,mark,a,span'));
      for (const elemento of involucros.reverse()) {
        if (!elemento.hasChildNodes() && !elementoProtegido(elemento)) elemento.remove();
      }
      const textosAtuais = editor.getDoc().createTreeWalker(blocos[0], 4);
      let restante = posicaoCursor;
      let encontrou = false;
      while (textosAtuais.nextNode()) {
        const texto = textosAtuais.currentNode as Text;
        if (restante <= texto.length) {
          editor.selection.setCursorLocation(texto, restante);
          encontrou = true;
          break;
        }
        restante -= texto.length;
      }
      if (!encontrou) editor.selection.setCursorLocation(blocos[0], 0);
    }
  });
  editor.nodeChanged();
}
