export const ESTILOS_SELETORES_TABELA_LAUDO = `
  select.seletor-tabela-laudo,
  select.seletor-tabela-laudo::picker(select) { appearance: base-select; }
  select.seletor-tabela-laudo {
    display: block; position: relative; field-sizing: content;
    inline-size: fit-content; max-inline-size: 100%; min-inline-size: 0;
    block-size: auto; min-block-size: 1.8em; margin: 0 auto;
    box-sizing: border-box; font: inherit; line-height: 1.3;
    text-align: center; text-align-last: center;
    white-space: normal; overflow-wrap: anywhere;
    border: 1px solid #a1a1aa; border-radius: 4px;
    padding: 2px .75em; cursor: pointer;
  }
  :where(select.seletor-tabela-laudo) { color: var(--cor-texto-editor); background-color: #fff; }
  select.seletor-tabela-laudo > button {
    display: block; inline-size: 100%; min-inline-size: 0;
    margin: 0; padding: 0; border: 0; background: transparent;
    color: inherit; font: inherit; line-height: inherit;
    text-align: center; white-space: normal; overflow-wrap: anywhere;
  }
  select.seletor-tabela-laudo selectedcontent {
    display: block; min-inline-size: 0; white-space: normal;
    overflow-wrap: anywhere; text-align: center;
  }
  select.seletor-tabela-laudo::picker-icon {
    position: absolute; font-size: .65em; inset-inline-end: .25em; inset-block-start: 50%;
    transform: translateY(-50%); margin: 0;
  }
  select.seletor-tabela-laudo::picker(select) {
    inline-size: max-content; min-inline-size: anchor-size(width);
    inset: auto; position-area: block-end span-inline-end; position-try-fallbacks: flip-inline;
    max-inline-size: min(32rem, var(--largura-lista-seletor, calc(100vw - 24px)));
    max-block-size: min(20rem, var(--altura-lista-seletor, calc(100vh - 24px)));
    box-sizing: border-box; overflow: auto; padding: 4px;
    font: inherit; color: var(--cor-texto-editor); background-color: #fff;
    border: 1px solid #a1a1aa; border-radius: 6px;
  }
  select.seletor-tabela-laudo[data-posicao-lista="acima"]::picker(select) { position-area: block-start span-inline-end; }
  select.seletor-tabela-laudo option {
    display: block; position: relative; min-inline-size: 0;
    padding: .35em 1.5em; text-align: center; text-align-last: center;
    white-space: normal; overflow-wrap: anywhere; line-height: 1.3;
  }
  select.seletor-tabela-laudo option::checkmark {
    position: absolute; inset-inline-start: .3em; inset-block-start: 50%;
    transform: translateY(-50%);
  }
  select.seletor-tabela-laudo.campo-reservado { padding-inline: .75em; }
  body.dark-content :where(select.seletor-tabela-laudo),
  body.dark-content select.seletor-tabela-laudo::picker(select) { background-color: #222f3e; color-scheme: dark; }
`;

const documentosObservados = new WeakSet<Document>();

function ajustarLimitesLista(controle: HTMLSelectElement, propriedades: CSSStyleDeclaration): void {
  const janela = controle.ownerDocument.defaultView;
  if (!janela) return;
  let contexto = janela;
  let topoCampo = controle.getBoundingClientRect().top;
  let baseCampo = controle.getBoundingClientRect().bottom;
  const limites = { topo: 0, base: janela.innerHeight, esquerda: 0, direita: janela.innerWidth };
  while (contexto.frameElement) {
    const frame = contexto.frameElement;
    const pai = frame.ownerDocument.defaultView;
    if (!pai) break;
    const retangulo = frame.getBoundingClientRect();
    const deslocamentoY = retangulo.top + frame.clientTop;
    const deslocamentoX = retangulo.left + frame.clientLeft;
    topoCampo += deslocamentoY;
    baseCampo += deslocamentoY;
    limites.topo = Math.max(0, limites.topo + deslocamentoY);
    limites.base = Math.min(pai.innerHeight, limites.base + deslocamentoY);
    limites.esquerda = Math.max(0, limites.esquerda + deslocamentoX);
    limites.direita = Math.min(pai.innerWidth, limites.direita + deslocamentoX);
    for (let ancestral = frame.parentElement; ancestral; ancestral = ancestral.parentElement) {
      const estilo = pai.getComputedStyle(ancestral);
      const caixa = ancestral.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(estilo.overflowY)) {
        limites.topo = Math.max(limites.topo, caixa.top + ancestral.clientTop);
        limites.base = Math.min(limites.base, caixa.top + ancestral.clientTop + ancestral.clientHeight);
      }
      if (/auto|scroll|hidden|clip/.test(estilo.overflowX)) {
        limites.esquerda = Math.max(limites.esquerda, caixa.left + ancestral.clientLeft);
        limites.direita = Math.min(limites.direita, caixa.left + ancestral.clientLeft + ancestral.clientWidth);
      }
    }
    contexto = pai;
  }
  const acima = Math.max(0, topoCampo - limites.topo - 8);
  const abaixo = Math.max(0, limites.base - baseCampo - 8);
  const abrirAcima = abaixo < Math.min(240, acima);
  const posicao = abrirAcima ? 'acima' : 'abaixo';
  if (controle.getAttribute('data-posicao-lista') !== posicao) controle.setAttribute('data-posicao-lista', posicao);
  propriedades.setProperty('--altura-lista-seletor', `${Math.max(1, Math.floor(abrirAcima ? acima : abaixo))}px`);
  propriedades.setProperty('--largura-lista-seletor', `${Math.max(1, Math.floor(limites.direita - limites.esquerda - 16))}px`);
}

function observarAreaVisivel(documento: Document): void {
  if (documentosObservados.has(documento)) return;
  const janela = documento.defaultView;
  if (!janela) return;
  const estilo = documento.createElement('style');
  estilo.textContent = ':root { --altura-lista-seletor: 20rem; }';
  documento.head.append(estilo);
  const regra = estilo.sheet?.cssRules[0];
  if (!(regra instanceof janela.CSSStyleRule)) { estilo.remove(); return; }
  documentosObservados.add(documento);
  const controlador = new janela.AbortController();
  const opcoes = { capture: true, signal: controlador.signal };
  const atualizar = (evento: Event) => {
    const alvo = evento.target;
    const controle = alvo instanceof janela.Element ? alvo.closest<HTMLSelectElement>('select.seletor-tabela-laudo') : null;
    if (controle) ajustarLimitesLista(controle, regra.style);
  };
  const atualizarAberto = () => {
    const controle = Array.from(documento.querySelectorAll<HTMLSelectElement>('select.seletor-tabela-laudo')).find(seletorTabelaEstaAberto);
    if (controle) ajustarLimitesLista(controle, regra.style);
  };
  documento.addEventListener('pointerdown', atualizar, opcoes);
  documento.addEventListener('keydown', atualizar, opcoes);
  documento.addEventListener('focusin', atualizar, opcoes);
  let contexto = janela;
  while (true) {
    contexto.addEventListener('scroll', atualizarAberto, opcoes);
    contexto.addEventListener('resize', atualizarAberto, opcoes);
    const pai = contexto.frameElement?.ownerDocument.defaultView;
    if (!pai) break;
    contexto = pai;
  }
  janela.addEventListener('unload', () => controlador.abort(), { once: true });
}

export function prepararApresentacaoSeletorTabela(controle: HTMLSelectElement): void {
  controle.classList.add('seletor-tabela-laudo');
  observarAreaVisivel(controle.ownerDocument);
  if (controle.querySelector(':scope > button')) return;
  const botao = controle.ownerDocument.createElement('button');
  botao.type = 'button';
  botao.tabIndex = -1;
  botao.append(controle.ownerDocument.createElement('selectedcontent'));
  controle.prepend(botao);
}

export function seletorTabelaEstaAberto(controle: HTMLSelectElement): boolean {
  try { return controle.matches(':open'); } catch { return false; }
}
