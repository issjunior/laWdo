const SELETOR_BLOCOS_PERICIAIS = '.cond-bloco[data-bloco-pericial]';
const SELETOR_ACAO_SUPRESSAO = ':scope > [data-acao-suprimir-bloco="true"]';
const SELETOR_ACAO_SUPRESSAO_GLOBAL = '[data-acao-suprimir-bloco="true"]';

interface ElementoComClosest {
  closest(seletor: string): Element | null;
}

function temClosest(alvo: EventTarget | null): alvo is EventTarget & ElementoComClosest {
  return alvo !== null
    && typeof alvo === 'object'
    && 'closest' in alvo
    && typeof (alvo as { closest?: unknown }).closest === 'function';
}

/**
 * Resolve a ação a partir de um evento do iframe do TinyMCE.
 * Não usa instanceof HTMLElement porque elementos de outro documento falham nessa verificação.
 */
export function encontrarAcaoSupressaoBloco(alvo: EventTarget | null): HTMLElement | null {
  if (!temClosest(alvo)) return null;
  return alvo.closest(SELETOR_ACAO_SUPRESSAO_GLOBAL) as HTMLElement | null;
}

/**
 * Inclui os controles transitórios dos blocos periciais no DOM do editor.
 * O atributo data-mce-bogus impede que o TinyMCE os serialize no HTML do laudo.
 */
export function sincronizarAcoesSupressaoBlocos(raiz: HTMLElement | null): number {
  if (!raiz) return 0;

  let adicionados = 0;
  const blocos = raiz.querySelectorAll<HTMLElement>(SELETOR_BLOCOS_PERICIAIS);
  blocos.forEach(bloco => {
    const acaoExistente = bloco.querySelector<HTMLElement>(SELETOR_ACAO_SUPRESSAO);
    if (acaoExistente) {
      acaoExistente.setAttribute('data-mce-bogus', 'all');
      return;
    }

    const acao = raiz.ownerDocument.createElement('span');
    acao.className = 'acao-suprimir-bloco';
    acao.setAttribute('contenteditable', 'false');
    acao.setAttribute('data-mce-bogus', 'all');
    acao.setAttribute('data-acao-suprimir-bloco', 'true');
    acao.setAttribute('role', 'button');
    acao.setAttribute('tabindex', '0');
    acao.setAttribute('aria-label', 'Suprimir bloco pericial');
    acao.setAttribute('title', 'Suprimir bloco pericial');
    acao.textContent = '×';
    bloco.prepend(acao);
    adicionados += 1;
  });

  return adicionados;
}
