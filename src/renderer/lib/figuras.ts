/**
 * Funções utilitárias para manipulação de figuras e legendas no laudo
 */
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import {
  AJUSTE_VISUAL_PADRAO_PAR_FIGURAS,
  ajusteVisualParFigurasValido,
  alturaEnquadramentoLegado,
  alturaParFigurasValida,
  ajustarNivelEnquadramentoPar,
  ALTURA_PADRAO_PAR_FIGURAS,
  ENQUADRAMENTO_PADRAO_PAR_FIGURAS,
  enquadramentoParFigurasValido,
  normalizarAlturaParFiguras,
  normalizarAjusteVisualParFiguras,
  type AjusteVisualParFiguras,
  type EnquadramentoParFiguras,
} from '@shared/figura/enquadramento';

const PREFIXO_FIGURA = /^\s*Fig(?:ura|\.)\s*(?:\d+|XX)\s*:?\s*/i;
const ID_MOLDURA_VAZIA_LOCAL_NECROPSIA = 'dummy-b601-local-necropsia-material-apresentado-1';
export const ENQUADRAMENTO_PAR_FIGURAS = ENQUADRAMENTO_PADRAO_PAR_FIGURAS;
const ATRIBUTO_ENQUADRAMENTO = 'data-enquadramento-figura';
const ATRIBUTO_LAYOUT_LINHA = 'data-layout-figuras';
const ATRIBUTO_ALTURA_PAR = 'data-altura-par-figuras';
const ATRIBUTO_AJUSTE_VISUAL_PAR = 'data-ajuste-visual-par';
const ATRIBUTO_LAYOUT_TABELA = 'data-layout-pares-figuras';
const ATRIBUTO_QUADRO_IMAGEM = 'data-quadro-figura';
const ATRIBUTO_CONTÊINER_QUADRO = 'data-conteiner-quadro-figura';
type PropriedadeEstiloEnquadramento = 'width' | 'height' | 'aspectRatio' | 'objectFit' | 'objectPosition'
  | 'backgroundColor' | 'boxSizing' | 'display' | 'verticalAlign' | 'overflow' | 'paddingBottom'
  | 'position' | 'top' | 'left' | 'tableLayout' | 'margin' | 'padding';

function definirEstilo(elemento: HTMLElement, propriedade: PropriedadeEstiloEnquadramento, valor: string): boolean {
  if (elemento.style[propriedade] === valor) return false;
  elemento.style[propriedade] = valor;
  return true;
}

function removerEstilo(elemento: HTMLElement, propriedade: PropriedadeEstiloEnquadramento): boolean {
  if (!elemento.style[propriedade]) return false;
  elemento.style[propriedade] = '';
  if (!elemento.getAttribute('style')?.trim()) elemento.removeAttribute('style');
  return true;
}

function removerEnquadramentoFigura(figura: HTMLElement): boolean {
  if (!figura.hasAttribute(ATRIBUTO_ENQUADRAMENTO)
    && !figura.hasAttribute(ATRIBUTO_ALTURA_PAR)
    && !figura.hasAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR)) return false;
  let alterou = true;
  figura.removeAttribute(ATRIBUTO_ENQUADRAMENTO);
  figura.removeAttribute(ATRIBUTO_ALTURA_PAR);
  figura.removeAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR);
  if (figura.style.width === '100%') alterou = removerEstilo(figura, 'width') || alterou;
  if (figura.style.display === 'block') alterou = removerEstilo(figura, 'display') || alterou;
  if (figura.style.boxSizing === 'border-box') alterou = removerEstilo(figura, 'boxSizing') || alterou;
  if (figura.style.margin === '0px') alterou = removerEstilo(figura, 'margin') || alterou;
  const imagem = figura.querySelector<HTMLElement>('img');
  if (!imagem) return alterou;
  const conteiner = imagem.parentElement?.hasAttribute(ATRIBUTO_CONTÊINER_QUADRO)
    ? imagem.parentElement : null;
  if (imagem.hasAttribute(ATRIBUTO_QUADRO_IMAGEM)) imagem.removeAttribute(ATRIBUTO_QUADRO_IMAGEM);
  for (const propriedade of [
    'width', 'height', 'aspectRatio', 'objectFit', 'objectPosition', 'backgroundColor', 'boxSizing', 'display',
    'position', 'top', 'left', 'margin',
  ] as const) {
    alterou = removerEstilo(imagem, propriedade) || alterou;
  }
  if (conteiner) conteiner.replaceWith(imagem);
  return alterou;
}

function celulaSemConteudoAlemDaFigura(celula: HTMLTableCellElement, figura?: Element): boolean {
  const copia = celula.cloneNode(true) as HTMLTableCellElement;
  if (figura) {
    const figuras = Array.from(celula.querySelectorAll('figure.laudo-figure'));
    copia.querySelectorAll('figure.laudo-figure').item(figuras.indexOf(figura))?.remove();
  }
  const possuiElementoEstrutural = Array.from(copia.querySelectorAll('*')).some(elemento => {
    if (!elemento.matches('p, div, span, br')) return true;
    return Array.from(elemento.attributes)
      .some(atributo => atributo.name.startsWith('data-') && !atributo.name.startsWith('data-mce-'));
  });
  if (possuiElementoEstrutural) return false;
  return !copia.textContent?.replace(/[\u00a0\u200B\uFEFF]/g, ' ').trim();
}

function removerNosAuxiliaresVazios(celula: HTMLTableCellElement): void {
  Array.from(celula.children).forEach(elemento => {
    if (!elemento.matches('p, div, span, br')) return;
    if (elemento.querySelector('figure.laudo-figure')) return;
    if (!celulaSemConteudoAlemDaFigura(elemento as HTMLTableCellElement)) return;
    elemento.remove();
  });
}

function ehCelulaTabela(elemento: Element): elemento is HTMLTableCellElement {
  return elemento.tagName === 'TD' || elemento.tagName === 'TH';
}

function obterParFotografico(linha: HTMLTableRowElement): {
  celulas: [HTMLTableCellElement, HTMLTableCellElement];
  figuras: [HTMLElement, HTMLElement];
} | null {
  const celulas = Array.from(linha.children).filter(ehCelulaTabela);
  if (celulas.length !== 2 || celulas.some(celula => celula.colSpan !== 1 || celula.rowSpan !== 1)) return null;
  const figuras = celulas.map(celula => Array.from(celula.querySelectorAll<HTMLElement>('figure.laudo-figure'))
    .filter(figura => figura.closest('td, th') === celula));
  if (figuras.some(lista => lista.length !== 1)
    || celulas.some((celula, indice) => !celulaSemConteudoAlemDaFigura(celula, figuras[indice][0]))) return null;
  return {
    celulas: celulas as [HTMLTableCellElement, HTMLTableCellElement],
    figuras: [figuras[0][0], figuras[1][0]],
  };
}

function obterEnquadramentoLinha(linha: HTMLTableRowElement, figuras: HTMLElement[]): EnquadramentoParFiguras {
  const valorLinha = linha.getAttribute(ATRIBUTO_LAYOUT_LINHA);
  if (enquadramentoParFigurasValido(valorLinha)) return valorLinha;
  const valorFigura = figuras.map(figura => figura.getAttribute(ATRIBUTO_ENQUADRAMENTO))
    .find(enquadramentoParFigurasValido);
  return valorFigura ?? ENQUADRAMENTO_PADRAO_PAR_FIGURAS;
}

function lerAlturaParAtributo(elemento: Element): number | undefined {
  const valor = Number(elemento.getAttribute(ATRIBUTO_ALTURA_PAR));
  return alturaParFigurasValida(valor) ? valor : undefined;
}

function obterAlturaParLinha(linha: HTMLTableRowElement, figuras: HTMLElement[]): number {
  const alturaPersistida = lerAlturaParAtributo(linha)
    ?? figuras.map(lerAlturaParAtributo).find((valor): valor is number => valor !== undefined);
  if (alturaPersistida !== undefined) return alturaPersistida;
  const enquadramentoLinha = linha.getAttribute(ATRIBUTO_LAYOUT_LINHA);
  const enquadramentoFigura = figuras.map(figura => figura.getAttribute(ATRIBUTO_ENQUADRAMENTO))
    .find(enquadramentoParFigurasValido);
  return alturaEnquadramentoLegado(enquadramentoParFigurasValido(enquadramentoLinha) ? enquadramentoLinha : enquadramentoFigura)
    ?? ALTURA_PADRAO_PAR_FIGURAS;
}

function obterAjusteVisualParLinha(linha: HTMLTableRowElement, figuras: HTMLElement[]): AjusteVisualParFiguras {
  const valorLinha = linha.getAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR);
  if (ajusteVisualParFigurasValido(valorLinha)) return valorLinha;
  const valorFigura = figuras.map(figura => figura.getAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR))
    .find(ajusteVisualParFigurasValido);
  return valorFigura ?? AJUSTE_VISUAL_PADRAO_PAR_FIGURAS;
}

export function obterEnquadramentoParFigura(figura: Element): EnquadramentoParFiguras | undefined {
  const linha = figura.closest<HTMLTableRowElement>('tr');
  if (!linha) return undefined;
  const par = obterParFotografico(linha);
  if (!par || !par.figuras.includes(figura as HTMLElement)) return undefined;
  return obterEnquadramentoLinha(linha, par.figuras);
}

export function obterAlturaParFigura(figura: Element): number | undefined {
  const linha = figura.closest<HTMLTableRowElement>('tr');
  if (!linha) return undefined;
  const par = obterParFotografico(linha);
  if (!par || !par.figuras.includes(figura as HTMLElement)) return undefined;
  return obterAlturaParLinha(linha, par.figuras);
}

export function obterAjusteVisualParFigura(figura: Element): AjusteVisualParFiguras | undefined {
  const linha = figura.closest<HTMLTableRowElement>('tr');
  if (!linha) return undefined;
  const par = obterParFotografico(linha);
  if (!par || !par.figuras.includes(figura as HTMLElement)) return undefined;
  return obterAjusteVisualParLinha(linha, par.figuras);
}

function centralizarFiguraRestante(
  linha: HTMLTableRowElement,
  celulaFigura: HTMLTableCellElement,
  figura: HTMLElement,
  celulaVazia: HTMLTableCellElement,
): void {
  removerNosAuxiliaresVazios(celulaFigura);
  removerNosAuxiliaresVazios(celulaVazia);
  linha.removeAttribute(ATRIBUTO_LAYOUT_LINHA);
  linha.removeAttribute(ATRIBUTO_ALTURA_PAR);
  linha.removeAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR);
  removerEnquadramentoFigura(figura);
  [celulaFigura, celulaVazia].forEach(celula => {
    if (celula.style.verticalAlign === 'top') removerEstilo(celula, 'verticalAlign');
    if (celula.style.width === '50%') removerEstilo(celula, 'width');
    if (celula.style.padding === '2px') removerEstilo(celula, 'padding');
  });
  const tabela = linha.closest<HTMLTableElement>('table');
  if (tabela && !Array.from(tabela.rows).some(obterParFotografico)) {
    tabela.removeAttribute(ATRIBUTO_LAYOUT_TABELA);
    if (tabela.style.tableLayout === 'fixed') removerEstilo(tabela, 'tableLayout');
  }
  celulaVazia.remove();
  celulaFigura.colSpan = 2;
  celulaFigura.style.textAlign = 'center';
  figura.style.marginLeft = 'auto';
  figura.style.marginRight = 'auto';
}

export function removerFiguraEReorganizarPar(figura: HTMLElement): boolean {
  const linha = figura.closest<HTMLTableRowElement>('tr');
  if (!linha) return false;
  const par = obterParFotografico(linha);
  if (!par) return false;
  const indiceFigura = par.figuras.indexOf(figura);
  if (indiceFigura < 0) return false;
  const indiceRestante = 1 - indiceFigura;
  figura.remove();
  centralizarFiguraRestante(
    linha,
    par.celulas[indiceRestante],
    par.figuras[indiceRestante],
    par.celulas[indiceFigura],
  );
  return true;
}

export function centralizarFigurasSozinhas(raiz: ParentNode): boolean {
  let alterou = false;
  raiz.querySelectorAll<HTMLTableRowElement>('table tr').forEach(linha => {
    const celulas = Array.from(linha.children).filter(ehCelulaTabela);
    if (celulas.length !== 2 || celulas.some(celula => celula.colSpan !== 1 || celula.rowSpan !== 1)) return;
    const figuras = celulas.map(celula => Array.from(celula.querySelectorAll('figure.laudo-figure'))
      .filter(figura => figura.closest('td, th') === celula));
    const indice = figuras.findIndex((lista, posicao) => lista.length === 1 && figuras[1 - posicao].length === 0);
    if (indice < 0) return;
    const celulaFigura = celulas[indice];
    const figura = figuras[indice][0];
    const celulaVazia = celulas[1 - indice];
    if (!celulaSemConteudoAlemDaFigura(celulaFigura, figura) || !celulaSemConteudoAlemDaFigura(celulaVazia)) return;
    centralizarFiguraRestante(linha, celulaFigura, figura as HTMLElement, celulaVazia);
    alterou = true;
  });
  return alterou;
}

export function normalizarParesFiguras(raiz: ParentNode): boolean {
  let alterou = false;
  const figurasEmPares = new Set<HTMLElement>();
  const linhasEmPares = new Set<HTMLTableRowElement>();
  const tabelasComPares = new Set<HTMLTableElement>();

  raiz.querySelectorAll<HTMLTableRowElement>('table tr').forEach(linha => {
    const par = obterParFotografico(linha);
    if (!par) return;
    const { celulas, figuras } = par;
    const alturaPercentual = obterAlturaParLinha(linha, figuras);
    const ajusteVisual = obterAjusteVisualParLinha(linha, figuras);
    const alturaCss = `${alturaPercentual}%`;
    const tabela = linha.closest<HTMLTableElement>('table');

    linhasEmPares.add(linha);
    if (tabela) {
      tabelasComPares.add(tabela);
      tabela.setAttribute(ATRIBUTO_LAYOUT_TABELA, 'true');
      alterou = definirEstilo(tabela, 'width', '100%') || alterou;
      alterou = definirEstilo(tabela, 'tableLayout', 'fixed') || alterou;
    }
    figuras.forEach(figura => figurasEmPares.add(figura));
    if (linha.getAttribute(ATRIBUTO_ALTURA_PAR) !== String(alturaPercentual)) {
      linha.setAttribute(ATRIBUTO_ALTURA_PAR, String(alturaPercentual));
      alterou = true;
    }
    if (linha.getAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR) !== ajusteVisual) {
      linha.setAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR, ajusteVisual);
      alterou = true;
    }
    if (linha.hasAttribute(ATRIBUTO_LAYOUT_LINHA)) { linha.removeAttribute(ATRIBUTO_LAYOUT_LINHA); alterou = true; }
    celulas.forEach(celula => {
      alterou = definirEstilo(celula, 'verticalAlign', 'top') || alterou;
      alterou = definirEstilo(celula, 'width', '50%') || alterou;
      alterou = definirEstilo(celula, 'padding', '2px') || alterou;
    });
    figuras.forEach(figura => {
      if (figura.getAttribute(ATRIBUTO_ALTURA_PAR) !== String(alturaPercentual)) {
        figura.setAttribute(ATRIBUTO_ALTURA_PAR, String(alturaPercentual));
        alterou = true;
      }
      if (figura.getAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR) !== ajusteVisual) {
        figura.setAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR, ajusteVisual);
        alterou = true;
      }
      if (figura.hasAttribute(ATRIBUTO_ENQUADRAMENTO)) { figura.removeAttribute(ATRIBUTO_ENQUADRAMENTO); alterou = true; }
      alterou = definirEstilo(figura, 'width', '100%') || alterou;
      alterou = definirEstilo(figura, 'display', 'block') || alterou;
      alterou = definirEstilo(figura, 'boxSizing', 'border-box') || alterou;
      alterou = definirEstilo(figura, 'margin', '0px') || alterou;
      const imagem = figura.querySelector<HTMLElement>('img');
      if (!imagem) return;
      let conteiner = imagem.parentElement?.hasAttribute(ATRIBUTO_CONTÊINER_QUADRO)
        ? imagem.parentElement : null;
      if (!conteiner) {
        conteiner = linha.ownerDocument.createElement('div');
        conteiner.setAttribute(ATRIBUTO_CONTÊINER_QUADRO, 'true');
        imagem.replaceWith(conteiner);
        conteiner.append(imagem);
        alterou = true;
      } else if (conteiner.getAttribute(ATRIBUTO_CONTÊINER_QUADRO) !== 'true') {
        conteiner.setAttribute(ATRIBUTO_CONTÊINER_QUADRO, 'true');
        alterou = true;
      }
      if (conteiner.getAttribute(ATRIBUTO_ALTURA_PAR) !== String(alturaPercentual)) {
        conteiner.setAttribute(ATRIBUTO_ALTURA_PAR, String(alturaPercentual));
        alterou = true;
      }
      alterou = definirEstilo(conteiner, 'width', '100%') || alterou;
      alterou = definirEstilo(conteiner, 'height', '0px') || alterou;
      alterou = definirEstilo(conteiner, 'paddingBottom', alturaCss) || alterou;
      alterou = removerEstilo(conteiner, 'aspectRatio') || alterou;
      alterou = definirEstilo(conteiner, 'position', 'relative') || alterou;
      alterou = definirEstilo(conteiner, 'backgroundColor', 'rgb(255, 255, 255)') || alterou;
      alterou = definirEstilo(conteiner, 'boxSizing', 'border-box') || alterou;
      alterou = definirEstilo(conteiner, 'display', 'block') || alterou;
      alterou = definirEstilo(conteiner, 'overflow', 'hidden') || alterou;
      if (imagem.getAttribute(ATRIBUTO_QUADRO_IMAGEM) !== 'true') {
        imagem.setAttribute(ATRIBUTO_QUADRO_IMAGEM, 'true');
        alterou = true;
      }
      if (imagem.hasAttribute('width')) { imagem.removeAttribute('width'); alterou = true; }
      if (imagem.hasAttribute('height')) { imagem.removeAttribute('height'); alterou = true; }
      alterou = definirEstilo(imagem, 'width', '100%') || alterou;
      alterou = definirEstilo(imagem, 'height', '100%') || alterou;
      alterou = definirEstilo(imagem, 'position', 'absolute') || alterou;
      alterou = definirEstilo(imagem, 'top', '0px') || alterou;
      alterou = definirEstilo(imagem, 'left', '0px') || alterou;
      alterou = removerEstilo(imagem, 'aspectRatio') || alterou;
      alterou = definirEstilo(imagem, 'objectFit', ajusteVisual === 'preencher' ? 'cover' : 'contain') || alterou;
      alterou = definirEstilo(imagem, 'objectPosition', 'center center') || alterou;
      alterou = definirEstilo(imagem, 'boxSizing', 'border-box') || alterou;
      alterou = definirEstilo(imagem, 'display', 'block') || alterou;
      alterou = definirEstilo(imagem, 'margin', '0px') || alterou;
    });
  });

  raiz.querySelectorAll<HTMLTableRowElement>(`tr[${ATRIBUTO_LAYOUT_LINHA}], tr[${ATRIBUTO_ALTURA_PAR}], tr[${ATRIBUTO_AJUSTE_VISUAL_PAR}]`).forEach(linha => {
    if (linhasEmPares.has(linha)) return;
    linha.removeAttribute(ATRIBUTO_LAYOUT_LINHA);
    linha.removeAttribute(ATRIBUTO_ALTURA_PAR);
    linha.removeAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR);
    alterou = true;
    Array.from(linha.children).filter(ehCelulaTabela)
      .forEach(celula => {
        if (celula.style.verticalAlign === 'top') alterou = removerEstilo(celula, 'verticalAlign') || alterou;
        if (celula.style.width === '50%') alterou = removerEstilo(celula, 'width') || alterou;
        if (celula.style.padding === '2px') alterou = removerEstilo(celula, 'padding') || alterou;
      });
  });
  raiz.querySelectorAll<HTMLTableElement>(`table[${ATRIBUTO_LAYOUT_TABELA}]`).forEach(tabela => {
    if (tabelasComPares.has(tabela)) return;
    tabela.removeAttribute(ATRIBUTO_LAYOUT_TABELA);
    if (tabela.style.tableLayout === 'fixed') alterou = removerEstilo(tabela, 'tableLayout') || alterou;
    if (tabela.style.width === '100%') alterou = removerEstilo(tabela, 'width') || alterou;
  });
  raiz.querySelectorAll<HTMLElement>(`figure[${ATRIBUTO_ENQUADRAMENTO}], figure[${ATRIBUTO_ALTURA_PAR}], figure[${ATRIBUTO_AJUSTE_VISUAL_PAR}]`).forEach(figura => {
    if (!figurasEmPares.has(figura)) alterou = removerEnquadramentoFigura(figura) || alterou;
  });
  return alterou;
}

export function ajustarAlturaParFiguras(
  figura: HTMLElement,
  direcao: 'aumentar' | 'reduzir',
): { alterou: boolean; enquadramento?: EnquadramentoParFiguras; figuras: HTMLElement[] } {
  const linha = figura.closest<HTMLTableRowElement>('tr');
  if (!linha) return { alterou: false, figuras: [] };
  const par = obterParFotografico(linha);
  if (!par || !par.figuras.includes(figura)) return { alterou: false, figuras: [] };
  const atual = obterEnquadramentoLinha(linha, par.figuras);
  const proximo = ajustarNivelEnquadramentoPar(atual, direcao);
  if (proximo === atual) return { alterou: false, enquadramento: atual, figuras: par.figuras };
  definirAlturaParFiguras(figura, alturaEnquadramentoLegado(proximo) ?? ALTURA_PADRAO_PAR_FIGURAS);
  return { alterou: true, enquadramento: proximo, figuras: par.figuras };
}

function obterParDaFigura(figura: HTMLElement): {
  linha: HTMLTableRowElement;
  figuras: [HTMLElement, HTMLElement];
} | null {
  const linha = figura.closest<HTMLTableRowElement>('tr');
  if (!linha) return null;
  const par = obterParFotografico(linha);
  if (!par || !par.figuras.includes(figura)) return null;
  return { linha, figuras: par.figuras };
}

export function previsualizarAlturaParFiguras(figura: HTMLElement, alturaPercentual: number): HTMLElement[] {
  const par = obterParDaFigura(figura);
  if (!par || !alturaParFigurasValida(alturaPercentual)) return [];
  const alturaCss = `${alturaPercentual}%`;
  for (const figuraPar of par.figuras) {
    const conteiner = figuraPar.querySelector<HTMLElement>(`[${ATRIBUTO_CONTÊINER_QUADRO}]`);
    if (conteiner) definirEstilo(conteiner, 'paddingBottom', alturaCss);
  }
  return par.figuras;
}

export function cancelarPrevisualizacaoAlturaParFiguras(figura: HTMLElement): boolean {
  if (!obterParDaFigura(figura)) return false;
  return normalizarParesFiguras(figura.ownerDocument.body);
}

export function definirAlturaParFiguras(
  figura: HTMLElement,
  alturaPercentual: number,
): { alterou: boolean; alturaPercentual?: number; figuras: HTMLElement[] } {
  const par = obterParDaFigura(figura);
  if (!par) return { alterou: false, figuras: [] };
  const altura = normalizarAlturaParFiguras(alturaPercentual);
  const atual = obterAlturaParLinha(par.linha, par.figuras);
  par.linha.setAttribute(ATRIBUTO_ALTURA_PAR, String(altura));
  par.linha.removeAttribute(ATRIBUTO_LAYOUT_LINHA);
  normalizarParesFiguras(par.linha.ownerDocument.body);
  return { alterou: atual !== altura, alturaPercentual: altura, figuras: par.figuras };
}

export function definirAjusteVisualParFiguras(
  figura: HTMLElement,
  ajusteVisual: AjusteVisualParFiguras,
): { alterou: boolean; ajusteVisual?: AjusteVisualParFiguras; figuras: HTMLElement[] } {
  const par = obterParDaFigura(figura);
  if (!par) return { alterou: false, figuras: [] };
  const ajuste = normalizarAjusteVisualParFiguras(ajusteVisual);
  const atual = obterAjusteVisualParLinha(par.linha, par.figuras);
  par.linha.setAttribute(ATRIBUTO_AJUSTE_VISUAL_PAR, ajuste);
  normalizarParesFiguras(par.linha.ownerDocument.body);
  return { alterou: atual !== ajuste, ajusteVisual: ajuste, figuras: par.figuras };
}

export function centralizarFigurasSozinhasHtml(html: string): string {
  if (!html.includes('laudo-figure') || !/<table\b/i.test(html)) return html;
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const alterou = centralizarFigurasSozinhas(documento.body);
  return (normalizarParesFiguras(documento.body) || alterou) ? documento.body.innerHTML : html;
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
    attributeFilter: [
      'src', 'style', 'data-image-id', 'data-image-original-id', 'data-dummy',
      ATRIBUTO_LAYOUT_TABELA, ATRIBUTO_LAYOUT_LINHA, ATRIBUTO_ALTURA_PAR, ATRIBUTO_AJUSTE_VISUAL_PAR, ATRIBUTO_ENQUADRAMENTO,
      ATRIBUTO_QUADRO_IMAGEM, ATRIBUTO_CONTÊINER_QUADRO,
    ],
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
  normalizarParesFiguras(doc.body);
  const figures = doc.querySelectorAll('.laudo-figure');

  figures.forEach((figure, index) => { atualizarNumeroFigura(figure, index + 1); });

  return doc.body.innerHTML;
}

