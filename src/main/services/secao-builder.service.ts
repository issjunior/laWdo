import { SecaoTemplateRow } from '../types/database.js';

interface ContextoCondicionalArma {
  indiceArma?: number;
  arma?: Record<string, unknown>;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function removerPrefixoNumerico(titulo: string): string {
  return (titulo || '')
    .replace(/^\s*\d+(?:\.\d+)*\.?\s*/u, '')
    .trim();
}

function normalizarNomeSecao(nome: string): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function temConteudoUtil(html?: string | null): boolean {
  return Boolean(
    (html || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, '')
      .trim()
  );
}

function isSecaoDerivadaRep(secao: SecaoTemplateRow): boolean {
  const nome = normalizarNomeSecao(secao.nome);
  return Boolean(
    secao.repetir_para === 'armas'
    || nome.includes('CARTUCHO')
    || nome.includes('ESTOJO')
    || nome.includes('ARMA')
  );
}

function possuiDadosDerivados(secao: SecaoTemplateRow, camposEspecificos: Record<string, unknown>): boolean {
  const b602 = camposEspecificos?.b602 as Record<string, unknown> | undefined;
  if (!b602) return false;

  if (secao.repetir_para === 'armas') {
    const armas = b602.armas;
    return Array.isArray(armas) && armas.length > 0;
  }

  const nome = normalizarNomeSecao(secao.nome);
  if (nome.includes('CARTUCHO')) {
    const cartuchos = b602.cartuchos;
    return b602.cartuchos_toggle === 'on' || (Array.isArray(cartuchos) && cartuchos.length > 0);
  }

  if (nome.includes('ESTOJO')) {
    const estojos = b602.estojos;
    return b602.estojos_toggle === 'on' || (Array.isArray(estojos) && estojos.length > 0);
  }

  if (nome.includes('ARMA')) {
    const armas = b602.armas;
    return b602.armas_toggle === 'on' || (Array.isArray(armas) && armas.length > 0);
  }

  return true;
}

function criarHeading(params: {
  tag: 'h2' | 'h3' | 'h4';
  secaoId?: string;
  parentId?: string | null;
  nivel?: 2 | 3;
  tituloBase: string;
  tituloVisivel: string;
  derivadaRep?: boolean;
  atributosExtras?: Array<[string, string]>;
}): string {
  const atributos: string[] = [];

  if (params.secaoId) atributos.push(`data-secao-id="${escaparHtml(params.secaoId)}"`);
  if (params.parentId) atributos.push(`data-parent-id="${escaparHtml(params.parentId)}"`);
  if (params.nivel) atributos.push(`data-estrutura-nivel="${params.nivel}"`);
  atributos.push(`data-titulo-base="${escaparHtml(params.tituloBase)}"`);
  if (params.derivadaRep) atributos.push('data-derivada-rep="true"');
  for (const [chave, valor] of params.atributosExtras || []) {
    atributos.push(`${chave}="${escaparHtml(valor)}"`);
  }

  return `<${params.tag}${atributos.length > 0 ? ` ${atributos.join(' ')}` : ''}>${escaparHtml(params.tituloVisivel)}</${params.tag}>`;
}

function avaliarToggleSecao(toggleId: string, camposEspecificos: Record<string, unknown>): boolean {
  const b602 = camposEspecificos?.b602 as Record<string, unknown> | undefined;
  if (!b602) return false;

  const armaMatch = toggleId.match(/^b602_arma_(\d+)_(func|coleta)_toggle$/);
  if (armaMatch) {
    const idx = Number(armaMatch[1]) - 1;
    const armas = b602.armas as Record<string, unknown>[] | undefined;
    const arma = armas?.[idx];
    return arma?.[`${armaMatch[2]}_toggle`] === 'on';
  }

  const chave = toggleId.replace(/^b602_/, '');
  if (b602[chave] === 'on') return true;

  const chaveColecao = chave.replace(/_toggle$/, '');
  const valorColecao = b602[chaveColecao];
  return Array.isArray(valorColecao) && valorColecao.length > 0;
}

export function substituirIndicePlaceholders(html: string, idx: number): string {
  return html.replace(/\{\{([^}]+)\}\}/g, (_match, chave: string) => {
    return '{{' + chave.replace(/_1_/g, `_${idx}_`) + '}}';
  });
}

export function normalizarCondicaoPorArma(toggleId: string, idx: number): string {
  return toggleId
    .replace(/b602_arma_N_func_toggle/g, `b602_arma_${idx}_func_toggle`)
    .replace(/b602_arma_N_coleta_toggle/g, `b602_arma_${idx}_coleta_toggle`);
}

export function avaliarCondicaoBloco(
  toggleId: string,
  camposEspecificos: Record<string, unknown>,
  contexto: ContextoCondicionalArma = {}
): boolean {
  const b602 = camposEspecificos?.b602 as Record<string, unknown> | undefined;
  if (!b602) return false;

  const armaMatch = toggleId.match(/^b602_arma_(\d+)_(func|coleta)_toggle$/);
  if (armaMatch) {
    const idx = Number(armaMatch[1]) - 1;
    const chaveArma = `${armaMatch[2]}_toggle`;
    const armaAtual =
      contexto.arma && contexto.indiceArma === idx + 1
        ? contexto.arma
        : Array.isArray(b602.armas)
          ? (b602.armas[idx] as Record<string, unknown> | undefined)
          : undefined;

    return armaAtual?.[chaveArma] === 'on';
  }

  return avaliarToggleSecao(toggleId, camposEspecificos);
}

export function processarBlocosCondicionais(
  html: string,
  camposEspecificos: Record<string, unknown>,
  contexto: ContextoCondicionalArma = {}
): string {
  const BLOCK_REGEX_INNERMOST = /<div\b([^>]*)\bdata-cond-bloco="([^"]*)"([^>]*)>((?:(?!<div\b[^>]*\bdata-cond-bloco=)[\s\S])*?)<\/div>/gi;

  let resultado = html;
  let houveMudanca = true;

  while (houveMudanca) {
    houveMudanca = false;

    resultado = resultado.replace(BLOCK_REGEX_INNERMOST, (match, _attrsAntes, toggleId, _attrsDepois) => {
      houveMudanca = true;

      const toggleNormalizado = contexto.indiceArma
        ? normalizarCondicaoPorArma(toggleId, contexto.indiceArma)
        : toggleId;

      if (!avaliarCondicaoBloco(toggleNormalizado, camposEspecificos, contexto)) {
        return '';
      }

      if (toggleNormalizado === toggleId) {
        return match;
      }

      return match.replace(
        /\bdata-cond-bloco="[^"]*"/i,
        `data-cond-bloco="${toggleNormalizado}"`
      );
    });
  }

  return resultado;
}

function avaliarCondicaoSecao(secao: SecaoTemplateRow, camposEspecificos: Record<string, unknown>): boolean {
  if (isSecaoDerivadaRep(secao) && !possuiDadosDerivados(secao, camposEspecificos)) {
    return false;
  }

  if (!secao.condicao) return true;

  try {
    const condicao = JSON.parse(secao.condicao) as { campo?: string };
    if (!condicao?.campo) return true;
    return avaliarToggleSecao(condicao.campo, camposEspecificos);
  } catch {
    return true;
  }
}

function ordenarSecoes(secoes: SecaoTemplateRow[]): SecaoTemplateRow[] {
  return [...secoes].sort((a, b) => a.ordem - b.ordem);
}

export function filtrarSecoesAtivas(
  secoes: SecaoTemplateRow[],
  camposEspecificos: Record<string, unknown>
): SecaoTemplateRow[] {
  const secoesOrdenadas = ordenarSecoes(secoes);
  const ativas = new Set(
    secoesOrdenadas
      .filter(secao => avaliarCondicaoSecao(secao, camposEspecificos))
      .map(secao => secao.id)
  );

  const filhosPorPai = new Map<string, SecaoTemplateRow[]>();
  for (const secao of secoesOrdenadas) {
    if (!secao.parent_id) continue;
    const filhos = filhosPorPai.get(secao.parent_id) || [];
    filhos.push(secao);
    filhosPorPai.set(secao.parent_id, ordenarSecoes(filhos));
  }

  for (const secao of secoesOrdenadas.filter(item => !item.parent_id)) {
    const filhos = filhosPorPai.get(secao.id) || [];
    const filhosAtivos = filhos.filter(filho => ativas.has(filho.id));
    const conteudoPai = processarBlocosCondicionais(secao.conteudo || '', camposEspecificos);

    if (filhosAtivos.length > 0) {
      ativas.add(secao.id);
      continue;
    }

    if (filhos.length > 0 && !temConteudoUtil(conteudoPai)) {
      ativas.delete(secao.id);
    }
  }

  return secoesOrdenadas.filter(secao => (
    ativas.has(secao.id)
    && (!secao.parent_id || ativas.has(secao.parent_id))
  ));
}

export function expandirSecoesRepetiveis(
  secoes: SecaoTemplateRow[],
  camposEspecificos: Record<string, unknown>
): Map<string, string> {
  const resultado = new Map<string, string>();

  for (const secao of secoes) {
    if (secao.repetir_para !== 'armas') continue;

    const b602 = camposEspecificos?.b602 as Record<string, unknown> | undefined;
    const armas = b602?.armas as Record<string, unknown>[] | undefined;

    if (!armas || armas.length === 0) {
      resultado.set('armas', '');
      continue;
    }

    const partes: string[] = [];
    for (let i = 0; i < armas.length; i++) {
      const idx = i + 1;
      const armaAtual = armas[i] as Record<string, unknown>;
      const tituloBase = substituirIndicePlaceholders(secao.repetir_titulo || secao.nome, idx);
      const conteudo = processarBlocosCondicionais(
        substituirIndicePlaceholders(secao.conteudo || '', idx),
        camposEspecificos,
        { indiceArma: idx, arma: armaAtual }
      );

      partes.push(
        criarHeading({
          tag: 'h4',
          tituloBase,
          tituloVisivel: removerPrefixoNumerico(tituloBase),
          atributosExtras: [
            ['data-repeat-item', 'arma'],
            ['data-arma-indice', String(idx)],
          ],
        })
      );

      if (temConteudoUtil(conteudo)) {
        partes.push(conteudo);
      }
    }

    resultado.set('armas',
      `<div data-repeat-group="armas" data-repeat-owner="${escaparHtml(secao.id)}">\n${partes.join('\n')}\n</div>`
    );
  }

  return resultado;
}

export function colapsarSecoesExpandidas(html: string): string {
  return html.replace(/<div\s+data-repeat-group="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
}

export function reconciliarSecoes(
  htmlColapsado: string,
  expansoes: Map<string, string>
): string {
  let html = htmlColapsado;

  for (const [repeatGroup, htmlGrupo] of expansoes) {
    const regexH3 = new RegExp(
      `<h3[^>]*data-repeat-section="${repeatGroup}"[^>]*>[\\s\\S]*?<\\/h3>`,
      'i'
    );
    const match = regexH3.exec(html);
    if (!match) continue;

    const posFimHeading = match.index + match[0].length;
    if (htmlGrupo) {
      html = html.slice(0, posFimHeading) + '\n' + htmlGrupo + html.slice(posFimHeading);
    }
  }

  return html;
}

export function buildHtml(
  secoes: SecaoTemplateRow[],
  expansoes: Map<string, string>,
  camposEspecificos: Record<string, unknown>
): string {
  const secoesOrdenadas = ordenarSecoes(secoes);
  const filhosPorPai = new Map<string, SecaoTemplateRow[]>();

  for (const secao of secoesOrdenadas) {
    if (!secao.parent_id) continue;
    const filhos = filhosPorPai.get(secao.parent_id) || [];
    filhos.push(secao);
    filhosPorPai.set(secao.parent_id, ordenarSecoes(filhos));
  }

  let indiceH2 = 0;
  const partes: string[] = [];

  for (const pai of secoesOrdenadas.filter(secao => !secao.parent_id)) {
    const filhos = filhosPorPai.get(pai.id) || [];
    const conteudoPai = processarBlocosCondicionais(pai.conteudo || '', camposEspecificos);
    const mostrarPai = filhos.length > 0 || temConteudoUtil(conteudoPai);

    if (!mostrarPai) continue;

    indiceH2 += 1;
    const tituloPai = removerPrefixoNumerico(pai.nome);
    partes.push(criarHeading({
      tag: 'h2',
      secaoId: pai.id,
      nivel: 2,
      tituloBase: tituloPai,
      tituloVisivel: `${indiceH2}. ${tituloPai}`,
      derivadaRep: isSecaoDerivadaRep(pai),
    }));

    if (temConteudoUtil(conteudoPai)) {
      partes.push(conteudoPai);
    }

    let indiceH3 = 0;
    for (const filho of filhos) {
      indiceH3 += 1;
      const tituloFilho = removerPrefixoNumerico(filho.nome);
      partes.push(criarHeading({
        tag: 'h3',
        secaoId: filho.id,
        parentId: pai.id,
        nivel: 3,
        tituloBase: tituloFilho,
        tituloVisivel: `${indiceH2}.${indiceH3} ${tituloFilho}`,
        derivadaRep: isSecaoDerivadaRep(filho),
        atributosExtras: filho.repetir_para ? [['data-repeat-section', filho.repetir_para]] : undefined,
      }));

      const conteudoFilho = filho.repetir_para === 'armas'
        ? (expansoes.get('armas') || '')
        : processarBlocosCondicionais(filho.conteudo || '', camposEspecificos);

      if (temConteudoUtil(conteudoFilho) || /data-repeat-group=/.test(conteudoFilho)) {
        partes.push(conteudoFilho);
      }
    }
  }

  return partes.join('\n');
}
