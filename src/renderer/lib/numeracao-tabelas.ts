export interface ResultadoNumeracaoTabelas {
  alterado: boolean;
  alteradoPersistente: boolean;
  proximoNumero: number;
}

interface OpcoesNumeracaoTabelas {
  incluirPrevias?: boolean;
  numeroInicial?: number;
}

const PREFIXO_TABELA = /^(\s*TABELA\s+)\d+\b/i;

function obterTitulo(tabela: HTMLTableElement): HTMLElement | null {
  const legenda = tabela.caption;
  if (legenda && PREFIXO_TABELA.test(legenda.textContent || '')) return legenda;
  const primeiraCelula = tabela.rows[0]?.cells[0];
  return primeiraCelula && PREFIXO_TABELA.test(primeiraCelula.textContent || '')
    ? primeiraCelula
    : null;
}

function corrigirTitulo(titulo: HTMLElement, numero: number): boolean {
  const texto = titulo.textContent || '';
  const correspondencia = PREFIXO_TABELA.exec(texto);
  if (!correspondencia) return false;

  const inicioNumero = correspondencia[1].length;
  const fimNumero = correspondencia[0].length;
  const numeroAtual = texto.slice(inicioNumero, fimNumero);
  if (numeroAtual === String(numero)) return false;

  const nos: Text[] = [];
  const percurso = titulo.ownerDocument.createTreeWalker(titulo, NodeFilter.SHOW_TEXT);
  while (percurso.nextNode()) nos.push(percurso.currentNode as Text);

  let posicao = 0;
  let inserido = false;
  for (const no of nos) {
    const conteudo = no.data;
    const inicio = Math.max(0, inicioNumero - posicao);
    const fim = Math.min(conteudo.length, fimNumero - posicao);
    if (inicio < fim) {
      no.data = conteudo.slice(0, inicio) + (inserido ? '' : String(numero)) + conteudo.slice(fim);
      inserido = true;
    }
    posicao += conteudo.length;
    if (posicao >= fimNumero) break;
  }
  return true;
}

export function renumerarTabelas(
  raiz: ParentNode,
  opcoes: OpcoesNumeracaoTabelas = {},
): ResultadoNumeracaoTabelas {
  let proximoNumero = opcoes.numeroInicial ?? 1;
  let alterado = false;
  let alteradoPersistente = false;
  raiz.querySelectorAll<HTMLTableElement>('table').forEach(tabela => {
    const previa = Boolean(tabela.closest('[data-placeholder-preview="true"]'));
    if (!opcoes.incluirPrevias && previa) return;
    const titulo = obterTitulo(tabela);
    if (!titulo) return;
    const corrigido = corrigirTitulo(titulo, proximoNumero);
    alterado = corrigido || alterado;
    alteradoPersistente = (corrigido && !previa) || alteradoPersistente;
    proximoNumero += 1;
  });
  return { alterado, alteradoPersistente, proximoNumero };
}

export function renumerarTabelasHtml(html: string): string {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const resultado = renumerarTabelas(documento.body);
  return resultado.alterado ? documento.body.innerHTML : html;
}
