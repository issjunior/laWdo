import { removerFormatacaoPlaceholders } from './utils';
import { renumerarTabelasHtml } from './numeracao-tabelas';

const elementosDeBloco = new Set(['ADDRESS', 'ARTICLE', 'BLOCKQUOTE', 'DIV', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'LI', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL']);

export function normalizarConteudoComparavel(html: string): string {
  const documento = new DOMParser().parseFromString(
    renumerarTabelasHtml(removerFormatacaoPlaceholders(html)), 'text/html',
  );
  documento.body.querySelectorAll('[data-b601-origem-projetil="true"], [data-b601-campo-projetil]').forEach(campo => {
    campo.replaceWith(...Array.from(campo.childNodes));
  });
  Array.from(documento.body.childNodes).forEach(no => {
    if (no.nodeType !== Node.TEXT_NODE || no.textContent?.trim()) return;
    const anterior = no.previousSibling;
    const proximo = no.nextSibling;
    if (anterior instanceof Element && proximo instanceof Element
      && elementosDeBloco.has(anterior.tagName) && elementosDeBloco.has(proximo.tagName)) no.remove();
  });
  documento.body.querySelectorAll<HTMLElement>('*').forEach(elemento => {
    if (elemento.hasAttribute('data-placeholder')) {
      elemento.classList.remove('campo-reservado', 'placeholder-personalizado');
    }
    for (const atributo of Array.from(elemento.attributes)) {
      if (atributo.name.startsWith('data-mce-')) elemento.removeAttribute(atributo.name);
    }
    if (!elemento.getAttribute('class')?.trim()) elemento.removeAttribute('class');
    if (!elemento.getAttribute('style')?.trim()) elemento.removeAttribute('style');
    const atributos = Array.from(elemento.attributes).sort((a, b) => a.name.localeCompare(b.name));
    atributos.forEach(atributo => elemento.removeAttribute(atributo.name));
    atributos.forEach(atributo => elemento.setAttribute(atributo.name, atributo.value));
  });
  return documento.body.innerHTML;
}
