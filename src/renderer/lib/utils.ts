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

function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRegexPlaceholderIndexado(chaveBase: string): RegExp | null {
  if (!chaveBase.includes('_N_')) return null;
  return new RegExp(`^${escaparRegex(chaveBase).replace('_N_', '_(\\d+)_')}$`);
}

export function placeholderChaveEhValida(chave: string, chavesValidas: Iterable<string>): boolean {
  const lista = Array.isArray(chavesValidas) ? chavesValidas : Array.from(chavesValidas);
  if (lista.includes(chave)) return true;

  return lista.some((chaveBase) => {
    const regex = getRegexPlaceholderIndexado(chaveBase);
    return regex ? regex.test(chave) : false;
  });
}

export function segmentarTextoComPlaceholders(texto: string, chavesValidas: Iterable<string>) {
  const segmentos: Array<{ tipo: 'texto' | 'placeholder'; valor: string }> = [];
  const regex = /\{\{([^{}]+)\}\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(texto)) !== null) {
    if (match.index > cursor) {
      segmentos.push({ tipo: 'texto', valor: texto.slice(cursor, match.index) });
    }

    const valor = match[0];
    const chave = match[1];
    segmentos.push({
      tipo: placeholderChaveEhValida(chave, chavesValidas) ? 'placeholder' : 'texto',
      valor,
    });

    cursor = match.index + valor.length;
  }

  if (cursor < texto.length) {
    segmentos.push({ tipo: 'texto', valor: texto.slice(cursor) });
  }

  return segmentos;
}

export function converterPlaceholdersTextuais(html: string, chavesValidas: string[], converterReservados = false): string {
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (chavesValidas.length > 0) {
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
        if (placeholderChaveEhValida(match[1], chavesValidas)) {
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
        span.setAttribute('contenteditable', 'false');
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
  }

  if (converterReservados) {
    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    const regex = /XXX/gi;

    for (const textNode of textNodes) {
      const parent = textNode.parentElement;
      if (parent?.classList?.contains('campo-reservado')) continue;
      if (parent?.getAttribute?.('data-reservado')) continue;

      const text = textNode.textContent || '';
      const substituicoes: { pos: number; fim: number; padrao: string }[] = [];
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        substituicoes.push({ pos: match.index, fim: match.index + match[0].length, padrao: match[0] });
      }

      if (substituicoes.length === 0) continue;

      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const s of substituicoes) {
        if (s.pos > cursor) {
          fragment.appendChild(document.createTextNode(text.substring(cursor, s.pos)));
        }
        const span = document.createElement('span');
        span.className = 'campo-reservado';
        span.setAttribute('data-reservado', 'true');
        span.textContent = s.padrao;
        fragment.appendChild(span);
        cursor = s.fim;
      }
      if (cursor < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(cursor)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  }

  return doc.body.innerHTML;
}
