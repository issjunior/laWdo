const SELETOR_BLOCOS_PERICIAIS = '.cond-bloco[data-bloco-pericial]';
const SELETOR_ACAO_SUPRESSAO = ':scope > [data-acao-suprimir-bloco="true"]';
const SELETOR_ACAO_SUPRESSAO_GLOBAL = '[data-acao-suprimir-bloco="true"]';
const SELETOR_BLOCOS_CONDICIONAIS = '.cond-bloco[data-cond-bloco]';
const SELETOR_ACAO_BLOCO_CONDICIONAL = '[data-acao-bloco-condicional]';

export type AcaoBlocoCondicional = 'editar' | 'concluir' | 'excluir';

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

/** Resolve um controle transitório de qualquer bloco condicional no iframe do TinyMCE. */
export function encontrarAcaoBlocoCondicional(alvo: EventTarget | null): HTMLElement | null {
  if (!temClosest(alvo)) return null;
  return alvo.closest(SELETOR_ACAO_BLOCO_CONDICIONAL) as HTMLElement | null;
}

/**
 * Adiciona os controles de edição e exclusão aos blocos condicionais.
 * Eles são elementos bogus do TinyMCE e não integram o HTML persistido.
 */
export function sincronizarAcoesBlocosCondicionais(raiz: HTMLElement | null): number {
  if (!raiz) return 0;

  let adicionados = 0;
  raiz.querySelectorAll<HTMLElement>(SELETOR_BLOCOS_CONDICIONAIS).forEach(bloco => {
    const emEdicao = bloco.getAttribute('data-cond-em-edicao') === 'true';
    let grupo = bloco.querySelector<HTMLElement>(':scope > [data-controles-bloco-condicional="true"]');

    if (!grupo) {
      grupo = raiz.ownerDocument.createElement('span');
      grupo.className = 'controles-bloco-condicional';
      grupo.setAttribute('contenteditable', 'false');
      grupo.setAttribute('data-mce-bogus', 'all');
      grupo.setAttribute('data-controles-bloco-condicional', 'true');
      bloco.prepend(grupo);
      adicionados += 1;
    }

    grupo.replaceChildren();
    const controles: Array<{ acao: AcaoBlocoCondicional; texto: string; titulo: string }> = [
      {
        acao: emEdicao ? 'concluir' : 'editar',
        texto: emEdicao ? 'Concluir' : 'Editar',
        titulo: emEdicao ? 'Concluir edição do bloco condicional' : 'Editar bloco condicional',
      },
      { acao: 'excluir', texto: '×', titulo: 'Excluir bloco condicional' },
    ];

    controles.forEach(({ acao, texto, titulo }) => {
      const controle = raiz.ownerDocument.createElement('span');
      controle.className = `acao-bloco-condicional acao-bloco-condicional-${acao}`;
      controle.setAttribute('contenteditable', 'false');
      controle.setAttribute('data-mce-bogus', 'all');
      controle.setAttribute('data-acao-bloco-condicional', acao);
      controle.setAttribute('role', 'button');
      controle.setAttribute('tabindex', '0');
      controle.setAttribute('aria-label', titulo);
      controle.setAttribute('title', titulo);
      controle.textContent = texto;
      grupo?.append(controle);
    });
  });

  return adicionados;
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
