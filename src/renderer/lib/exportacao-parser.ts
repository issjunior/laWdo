export interface ImagemExportacao {
  id: string;
  base64: string;
  formato: string;
  legenda: string;
  numero: number;
}

export interface ElementoParagrafo {
  tipo: 'paragrafo';
  html: string;
  alinhamento?: string;
  nivelTitulo?: number;
}

export interface ElementoTabela {
  tipo: 'tabela';
  linhas: string[][];
  cabecalho?: boolean;
}

export interface ElementoLista {
  tipo: 'lista';
  items: string[];
  ordenada: boolean;
  nivel: number;
}

export interface ElementoFigura {
  tipo: 'figura';
  imagemId: string;
  legenda: string;
  numero: number;
}

export interface ElementoQuebra {
  tipo: 'quebra';
}

export type ElementoExportacao =
  | ElementoParagrafo
  | ElementoTabela
  | ElementoLista
  | ElementoFigura
  | ElementoQuebra;

export interface SecaoExportacao {
  titulo: string;
  elementos: ElementoExportacao[];
}

export interface LaudoEstrutura {
  fontFamily: string;
  fontSize: string;
  secoes: SecaoExportacao[];
  imagens: ImagemExportacao[];
}

function extrairBase64(dataUri: string): { base64: string; formato: string } | null {
  const match = dataUri.match(/^data:image\/(jpeg|png|jpg|gif|webp);base64,(.+)$/i);
  if (!match) return null;
  const formato = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  return { base64: match[2], formato };
}

function parseAlinhamento(element: Element): string | undefined {
  const style = element.getAttribute('style') || '';
  if (/text-align:\s*center/i.test(style)) return 'center';
  if (/text-align:\s*right/i.test(style)) return 'right';
  if (/text-align:\s*justify/i.test(style)) return 'justify';
  return undefined;
}

function parseConteudoHtml(element: Element): string {
  return element.innerHTML.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function detectarFonte(doc: Document): { fontFamily: string; fontSize: string } {
  const firstP = doc.querySelector('p, div, span');
  if (firstP) {
    const computed = window.getComputedStyle(firstP);
    const family = computed.fontFamily || '';
    const size = computed.fontSize || '';
    if (family && family !== 'serif' && family !== 'sans-serif' && family !== 'monospace') {
      return { fontFamily: family.split(',')[0].replace(/['"]/g, '').trim(), fontSize: size };
    }
  }
  const h2 = doc.querySelector('h2');
  if (h2) {
    const computed = window.getComputedStyle(h2);
    return { fontFamily: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim() || 'Calibri', fontSize: '12pt' };
  }
  return { fontFamily: 'Calibri', fontSize: '12pt' };
}

function parseElementos(container: Element, imagensMap: Map<string, ImagemExportacao>): ElementoExportacao[] {
  const elementos: ElementoExportacao[] = [];

  for (const child of Array.from(container.children)) {
    const tag = child.tagName.toLowerCase();

    if (tag === 'figure' && child.classList.contains('laudo-figure')) {
      const img = child.querySelector('img');
      const figcaption = child.querySelector('figcaption');
      const imageId = child.getAttribute('data-image-id') || '';
      let legenda = figcaption ? figcaption.textContent?.trim() || '' : '';
      const numeroMatch = legenda.match(/^Figura\s*(\d+):?\s*/i);
      const numero = numeroMatch ? parseInt(numeroMatch[1], 10) : 0;
      if (numeroMatch) legenda = legenda.replace(/^Figura\s*\d+:?\s*/i, '').trim();

      if (img && imageId) {
        const src = img.getAttribute('src') || '';
        const parsed = extrairBase64(src);
        if (parsed) {
          if (!imagensMap.has(imageId)) {
            imagensMap.set(imageId, { id: imageId, base64: parsed.base64, formato: parsed.formato, legenda, numero });
          }
        }
      }

      elementos.push({ tipo: 'figura', imagemId: imageId, legenda, numero });
      continue;
    }

    if (tag === 'table') {
      const rows: string[][] = [];
      const headers = child.querySelectorAll('thead th, tr:first-child th');
      const cabecalho = headers.length > 0;

      for (const tr of Array.from(child.querySelectorAll('tr'))) {
        const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent?.trim() || '');
        if (cells.length > 0) rows.push(cells);
      }

      elementos.push({ tipo: 'tabela', linhas: rows, cabecalho });
      continue;
    }

    if (tag === 'ul') {
      const items = Array.from(child.querySelectorAll(':scope > li')).map(li => li.innerHTML.trim());
      if (items.length > 0) {
        elementos.push({ tipo: 'lista', items, ordenada: false, nivel: 1 });
      }
      continue;
    }

    if (tag === 'ol') {
      const items = Array.from(child.querySelectorAll(':scope > li')).map(li => li.innerHTML.trim());
      if (items.length > 0) {
        elementos.push({ tipo: 'lista', items, ordenada: true, nivel: 1 });
      }
      continue;
    }

    if (tag === 'hr') {
      elementos.push({ tipo: 'quebra' });
      continue;
    }

    if (tag === 'p' || tag === 'div' || tag === 'blockquote' || tag === 'pre') {
      const html = parseConteudoHtml(child);
      if (html.trim()) {
        const alinhamento = parseAlinhamento(child);
        elementos.push({ tipo: 'paragrafo', html, alinhamento });
      }
      continue;
    }

    if (tag.match(/^h[3-6]$/)) {
      const html = parseConteudoHtml(child);
      if (html.trim()) {
        const nivel = parseInt(tag[1], 10);
        elementos.push({ tipo: 'paragrafo', html, nivelTitulo: nivel });
      }
      continue;
    }

    if (tag === 'img') {
      continue;
    }

    const html = parseConteudoHtml(child);
    if (html.trim()) {
      elementos.push({ tipo: 'paragrafo', html });
    }
  }

  return elementos;
}

export function parseHtmlParaEstrutura(html: string): LaudoEstrutura {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const fonte = detectarFonte(doc);
  const imagensMap = new Map<string, ImagemExportacao>();
  const secoes: SecaoExportacao[] = [];

  const h2Elements = body.querySelectorAll('h2');
  const h2Indices: { titulo: string; startNode: Node | null }[] = [];

  h2Elements.forEach(h2 => {
    const titulo = h2.textContent?.trim() || '';
    h2Indices.push({ titulo, startNode: h2.nextSibling });
  });

  if (h2Indices.length === 0) {
    const elementos = parseElementos(body, imagensMap);
    secoes.push({ titulo: 'Conteúdo', elementos });
  } else {
    for (let i = 0; i < h2Indices.length; i++) {
      const { titulo, startNode } = h2Indices[i];
      const elementos: ElementoExportacao[] = [];

      let current: Node | null = startNode;
      const nextH2 = i < h2Indices.length - 1 ? h2Elements[i + 1] : null;

      while (current && current !== nextH2) {
        if (current.nodeType === Node.ELEMENT_NODE) {
          const el = current as Element;
          if (el.tagName.toLowerCase() === 'h2') break;
          const parsed = parseElementos(el, imagensMap);
          elementos.push(...parsed);
        }
        current = current.nextSibling;
      }

      secoes.push({ titulo, elementos });
    }
  }

  return {
    fontFamily: fonte.fontFamily,
    fontSize: fonte.fontSize,
    secoes,
    imagens: Array.from(imagensMap.values()),
  };
}
