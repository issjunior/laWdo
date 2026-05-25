import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utilitário para combinar classes Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function removerFormatacaoPlaceholders(html: string): string {
  return html;
}

export function converterPlaceholdersTextuais(html: string, chavesValidas: string[]): string {
  if (!html || chavesValidas.length === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const chavesSet = new Set(chavesValidas);

  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  const regex = /\{\{([^{}]+)\}\}/g;

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (parent?.classList?.contains('placeholder-tag')) continue;
    if (parent?.getAttribute?.('data-placeholder')) continue;

    const text = textNode.textContent || '';
    const substituicoes: { pos: number; fim: number; chave: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (chavesSet.has(match[1])) {
        substituicoes.push({ pos: match.index, fim: match.index + match[0].length, chave: match[1] });
      }
    }

    if (substituicoes.length === 0) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const s of substituicoes) {
      if (s.pos > cursor) {
        fragment.appendChild(document.createTextNode(text.substring(cursor, s.pos)));
      }
      const span = document.createElement('span');
      span.className = 'placeholder-tag';
      span.setAttribute('data-placeholder', `{{${s.chave}}}`);
      span.textContent = `{{${s.chave}}}`;
      fragment.appendChild(span);
      cursor = s.fim;
    }
    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(cursor)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return doc.body.innerHTML;
}