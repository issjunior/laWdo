/**
 * Funções utilitárias para manipulação de figuras e legendas no laudo
 */
import type { Editor as TinyMceEditorInstance } from 'tinymce';

const PREFIXO_FIGURA = /^\s*Fig(?:ura|\.)\s*(?:\d+|XX)\s*:?\s*/i;
const ID_MOLDURA_VAZIA_LOCAL_NECROPSIA = 'dummy-b601-local-necropsia-material-apresentado-1';

function celulaSemConteudoAlemDaFigura(celula: HTMLTableCellElement, figura?: Element): boolean {
  const copia = celula.cloneNode(true) as HTMLTableCellElement;
  if (figura) {
    const figuras = Array.from(celula.querySelectorAll('figure.laudo-figure'));
    copia.querySelectorAll('figure.laudo-figure').item(figuras.indexOf(figura))?.remove();
  }
  if (Array.from(copia.querySelectorAll('*')).some(elemento => !elemento.matches('p, div, span, br')
    || Array.from(elemento.attributes).some(atributo => atributo.name.startsWith('data-') && !atributo.name.startsWith('data-mce-')))) return false;
  return !copia.textContent?.replace(/\u00a0/g, ' ').trim();
}

export function centralizarFigurasSozinhas(raiz: ParentNode): boolean {
  let alterou = false;
  raiz.querySelectorAll<HTMLTableRowElement>('table tr').forEach(linha => {
    const celulas = Array.from(linha.children).filter((filho): filho is HTMLTableCellElement => filho instanceof HTMLTableCellElement);
    if (celulas.length !== 2 || celulas.some(celula => celula.colSpan !== 1 || celula.rowSpan !== 1)) return;
    const figuras = celulas.map(celula => Array.from(celula.querySelectorAll('figure.laudo-figure'))
      .filter(figura => figura.closest('td, th') === celula));
    const indice = figuras.findIndex((lista, posicao) => lista.length === 1 && figuras[1 - posicao].length === 0);
    if (indice < 0) return;
    const celulaFigura = celulas[indice];
    const figura = figuras[indice][0];
    const celulaVazia = celulas[1 - indice];
    if (!celulaSemConteudoAlemDaFigura(celulaFigura, figura) || !celulaSemConteudoAlemDaFigura(celulaVazia)) return;
    celulaVazia.remove();
    celulaFigura.colSpan = 2;
    celulaFigura.style.textAlign = 'center';
    (figura as HTMLElement).style.marginLeft = 'auto';
    (figura as HTMLElement).style.marginRight = 'auto';
    alterou = true;
  });
  return alterou;
}

export function centralizarFigurasSozinhasHtml(html: string): string {
  if (!html.includes('laudo-figure') || !/<table\b/i.test(html)) return html;
  const documento = new DOMParser().parseFromString(html, 'text/html');
  return centralizarFigurasSozinhas(documento.body) ? documento.body.innerHTML : html;
}

export function corrigirMolduraVaziaLocalNecropsia(html: string): string {
  if (!html.includes(ID_MOLDURA_VAZIA_LOCAL_NECROPSIA)) return html;
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const moldura = Array.from(documento.querySelectorAll<HTMLElement>('figure.laudo-figure[data-dummy="true"]'))
    .find(figura => figura.getAttribute('data-image-id') === ID_MOLDURA_VAZIA_LOCAL_NECROPSIA);
  if (!moldura) return html;
  const filhos = Array.from(moldura.childNodes).filter(no => no.nodeType !== Node.TEXT_NODE || Boolean(no.textContent?.trim()));
  if (filhos.length !== 1 || !(filhos[0] instanceof HTMLElement)) return html;
  const figura = filhos[0];
  if (!figura.matches('figure.laudo-figure') || !Array.from(figura.children).some(filho => filho.tagName === 'IMG')
    || !Array.from(figura.children).some(filho => filho.tagName === 'FIGCAPTION')) return html;
  moldura.replaceWith(figura);
  return documento.body.innerHTML;
}

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
    attributeFilter: ['src', 'data-image-id', 'data-image-original-id', 'data-dummy'],
  });
  editor.on('remove', () => observador.disconnect());
}

/**
 * Reindexa todas as figuras no HTML do laudo, garantindo que a numeração (Figura 01, 02...)
 * siga a ordem física de aparição no documento.
 */
export function reindexarFiguras(html: string): string {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  centralizarFigurasSozinhas(doc.body);
  const figures = doc.querySelectorAll('.laudo-figure');

  figures.forEach((figure, index) => { atualizarNumeroFigura(figure, index + 1); });

  return doc.body.innerHTML;
}

