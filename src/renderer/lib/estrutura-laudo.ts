export interface SecaoEstruturalLaudo {
  id?: string;
  parentId?: string | null;
  nivel: 2 | 3;
  titulo: string;
  conteudo: string;
  derivadaRep?: boolean;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializarNo(no: ChildNode): string {
  if (no.nodeType === Node.TEXT_NODE) return no.textContent || '';
  return (no as HTMLElement).outerHTML || '';
}

function normalizarTituloBase(texto: string): string {
  return texto
    .replace(/^\s*\d+(?:\.\d+)*\.?\s*/u, '')
    .replace(/^\s*[a-z]\)\s*/iu, '')
    .trim();
}

function getNivelEstrutural(elemento: Element): 2 | 3 | null {
  const tag = elemento.tagName.toLowerCase();
  const nivelAttr = elemento.getAttribute('data-estrutura-nivel');

  if (nivelAttr === '2' || tag === 'h2') return 2;
  if (nivelAttr === '3' || (tag === 'h3' && elemento.hasAttribute('data-secao-id'))) return 3;

  return null;
}

function montarTituloVisivel(titulo: string, nivel: 2 | 3, indiceH2: number, indiceH3: number): string {
  const base = normalizarTituloBase(titulo);
  return nivel === 2 ? `${indiceH2}. ${base}` : `${indiceH2}.${indiceH3} ${base}`;
}

function montarHeading(secao: SecaoEstruturalLaudo, indiceH2: number, indiceH3: number): string {
  const tag = secao.nivel === 2 ? 'h2' : 'h3';
  const tituloBase = normalizarTituloBase(secao.titulo || 'Seção');
  const atributos = [
    secao.id ? `data-secao-id="${escaparHtml(secao.id)}"` : '',
    secao.parentId ? `data-parent-id="${escaparHtml(secao.parentId)}"` : '',
    `data-estrutura-nivel="${secao.nivel}"`,
    `data-titulo-base="${escaparHtml(tituloBase)}"`,
    secao.derivadaRep ? 'data-derivada-rep="true"' : '',
  ].filter(Boolean).join(' ');

  return `<${tag}${atributos ? ` ${atributos}` : ''}>${escaparHtml(montarTituloVisivel(tituloBase, secao.nivel, indiceH2, indiceH3))}</${tag}>`;
}

export function normalizarTituloSecao(titulo: string): string {
  return normalizarTituloBase(titulo);
}

export function parsearSecoesEstruturais(html: string): SecaoEstruturalLaudo[] {
  if (!html?.trim()) {
    return [{ nivel: 2, titulo: 'Conteúdo', conteudo: '<p>&nbsp;</p>' }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const secoes: SecaoEstruturalLaudo[] = [];
  let secaoAtual: SecaoEstruturalLaudo | null = null;

  for (const no of Array.from(doc.body.childNodes)) {
    if (no.nodeType === Node.ELEMENT_NODE) {
      const elemento = no as Element;
      const nivel = getNivelEstrutural(elemento);

      if (nivel) {
        if (secaoAtual) {
          secaoAtual.conteudo = secaoAtual.conteudo.trim() || '<p>&nbsp;</p>';
          secoes.push(secaoAtual);
        }

        secaoAtual = {
          id: elemento.getAttribute('data-secao-id') || undefined,
          parentId: elemento.getAttribute('data-parent-id'),
          nivel,
          titulo: normalizarTituloBase(
            elemento.getAttribute('data-titulo-base')
            || elemento.textContent
            || `Seção ${secoes.length + 1}`
          ),
          conteudo: '',
          derivadaRep: elemento.getAttribute('data-derivada-rep') === 'true',
        };
        continue;
      }
    }

    if (!secaoAtual) {
      secaoAtual = {
        nivel: 2,
        titulo: 'Conteúdo',
        conteudo: serializarNo(no),
      };
      continue;
    }

    secaoAtual.conteudo += serializarNo(no);
  }

  if (secaoAtual) {
    secaoAtual.conteudo = secaoAtual.conteudo.trim() || '<p>&nbsp;</p>';
    secoes.push(secaoAtual);
  }

  return secoes.length > 0 ? secoes : [{ nivel: 2, titulo: 'Conteúdo', conteudo: html }];
}

export function reconstruirHtmlEstrutural(secoes: SecaoEstruturalLaudo[]): string {
  let indiceH2 = 0;
  let indiceH3 = 0;

  return secoes.map((secao) => {
    if (secao.nivel === 2) {
      indiceH2 += 1;
      indiceH3 = 0;
    } else {
      indiceH3 += 1;
    }

    const heading = montarHeading(secao, indiceH2, indiceH3);
    const conteudo = secao.conteudo?.trim() || '<p>&nbsp;</p>';
    return `${heading}\n${conteudo}`;
  }).join('\n');
}

export function reindexarHtmlEstrutural(html: string): string {
  if (!html?.trim()) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let indiceH2 = 0;
  let indiceH3 = 0;

  Array.from(doc.body.querySelectorAll('h2, h3')).forEach((heading) => {
    const nivel = getNivelEstrutural(heading);
    if (!nivel) return;

    if (nivel === 2) {
      indiceH2 += 1;
      indiceH3 = 0;
    } else {
      indiceH3 += 1;
    }

    const tituloBase = normalizarTituloBase(
      heading.getAttribute('data-titulo-base')
      || heading.textContent
      || 'Seção'
    );

    heading.setAttribute('data-estrutura-nivel', String(nivel));
    heading.setAttribute('data-titulo-base', tituloBase);
    heading.textContent = montarTituloVisivel(tituloBase, nivel, indiceH2, indiceH3);
  });

  return doc.body.innerHTML;
}

export function getClasseSecaoEstrutural(secao: Pick<SecaoEstruturalLaudo, 'titulo' | 'nivel'>): string {
  if (secao.nivel === 2) return 'border border-border bg-card shadow-sm';

  const nome = normalizarTituloBase(secao.titulo)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (nome.includes('CARTUCHO')) {
    return 'border border-sky-300 bg-sky-50/70 shadow-sm dark:border-sky-900 dark:bg-sky-950/20';
  }

  if (nome.includes('ESTOJO')) {
    return 'border border-emerald-300 bg-emerald-50/70 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20';
  }

  if (nome.includes('ARMA')) {
    return 'border border-amber-300 bg-amber-50/70 shadow-sm dark:border-amber-900 dark:bg-amber-950/20';
  }

  return 'border border-border bg-card shadow-sm';
}
