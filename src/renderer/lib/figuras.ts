/**
 * Funções utilitárias para manipulação de figuras e legendas no laudo
 */
import type { Editor as TinyMceEditorInstance } from 'tinymce';

const PREFIXO_FIGURA = /^\s*Fig(?:ura|\.)\s*(?:\d+|XX)\s*:?\s*/i;

export function extrairDescricaoFigura(texto: string): string {
  return texto.replace(PREFIXO_FIGURA, '').trim();
}

export function legendaFiguraAusente(figura: Element): boolean {
  const legenda = figura.querySelector('figcaption');
  return !legenda || !legenda.textContent?.trim();
}

export function restaurarLegendaFigura(figura: Element, numero: number, descricao: string): boolean {
  if (!legendaFiguraAusente(figura)) return false;
  const legenda = figura.querySelector('figcaption') || figura.ownerDocument.createElement('figcaption');
  if (!legenda.hasAttribute('style')) {
    legenda.setAttribute('style', 'font-size:13px;color:#666;font-weight:bold;margin-top:4px');
  }
  const texto = `Figura ${String(numero).padStart(2, '0')}${descricao ? `: ${descricao}` : ''}`;
  legenda.textContent = texto;
  if (!legenda.parentElement) figura.appendChild(legenda);
  const imagem = figura.querySelector('img');
  if (imagem) imagem.alt = texto;
  return true;
}

export function atualizarNumeroFigura(figura: Element, numero: number): boolean {
  const legenda = figura.querySelector('figcaption');
  if (!legenda?.textContent?.trim()) return false;

  const texto = legenda.textContent;
  const prefixoAtual = texto.match(PREFIXO_FIGURA)?.[0] || '';
  const descricao = extrairDescricaoFigura(texto);
  const prefixoNovo = `Figura ${String(numero).padStart(2, '0')}${descricao ? ': ' : ''}`;
  const textoNovo = `${prefixoNovo}${descricao}`;
  const imagem = figura.querySelector('img');
  if (prefixoAtual === prefixoNovo) {
    if (imagem && imagem.alt !== textoNovo) imagem.alt = textoNovo;
    return false;
  }

  if (prefixoAtual) {
    const documento = legenda.ownerDocument;
    const range = documento.createRange();
    const textos = documento.createTreeWalker(legenda, 4);
    let restante = prefixoAtual.length;
    range.setStart(legenda, 0);
    while (textos.nextNode()) {
      const no = textos.currentNode as Text;
      if (restante <= no.length) {
        range.setEnd(no, restante);
        break;
      }
      restante -= no.length;
    }
    range.deleteContents();
    range.insertNode(documento.createTextNode(prefixoNovo));
  } else {
    legenda.insertBefore(legenda.ownerDocument.createTextNode(prefixoNovo), legenda.firstChild);
  }
  if (imagem) imagem.alt = textoNovo;
  return true;
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

/**
 * Reindexa todas as figuras no HTML do laudo, garantindo que a numeração (Figura 01, 02...)
 * siga a ordem física de aparição no documento.
 */
export function reindexarFiguras(html: string): string {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const figures = doc.querySelectorAll('.laudo-figure');

  figures.forEach((figure, index) => { atualizarNumeroFigura(figure, index + 1); });

  return doc.body.innerHTML;
}

