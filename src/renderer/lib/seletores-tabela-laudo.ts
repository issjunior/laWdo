import type { Editor } from 'tinymce';
import { registrarPreparacaoConteudo } from './preparacao-conteudo-editor';

const seletorAcionador = '[data-seletor-tabela-acionador]';
const controles = new WeakMap<HTMLButtonElement, HTMLSelectElement>();
let fecharSeletorAtivo: (() => void) | null = null;

export function editorBloqueadoParaSeletores(editor: Editor): boolean {
  return editor.mode.isReadOnly() || editor.options?.get('disabled') === true;
}

export interface SessaoSeletorTabela {
  id: string;
  valor: string;
  rotulo: string;
  aceitaTextoLivre: boolean;
  digitar: (texto: string) => void;
  opcoes: { valor: string; texto: string; desabilitada: boolean }[];
  escolher: (valor: string) => void;
  fechar: (restaurar?: boolean) => void;
  concluirFechamento: () => void;
}

export function limparApresentacaoSeletoresTabela(raiz: ParentNode): void {
  raiz.querySelectorAll(seletorAcionador).forEach(botao => botao.remove());
}

export function prepararApresentacaoSeletorTabela(controle: HTMLSelectElement, textoAtual?: string): void {
  controle.hidden = true;
  controle.tabIndex = -1;
  controle.setAttribute('aria-hidden', 'true');
  controle.classList.add('seletor-tabela-ponte');
  let botao = controle.parentElement?.querySelector<HTMLButtonElement>(seletorAcionador);
  if (!botao) {
    const documento = controle.ownerDocument;
    botao = documento.createElement('button');
    botao.type = 'button';
    botao.className = 'seletor-tabela-acionador';
    botao.setAttribute('data-seletor-tabela-acionador', 'true');
    botao.setAttribute('data-mce-bogus', 'all');
    botao.setAttribute('contenteditable', 'false');
    botao.setAttribute('aria-haspopup', 'listbox');
    botao.setAttribute('aria-expanded', 'false');
    const texto = documento.createElement('span');
    const icone = documento.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icone.setAttribute('viewBox', '0 0 24 24');
    icone.setAttribute('aria-hidden', 'true');
    const caminho = documento.createElementNS('http://www.w3.org/2000/svg', 'path');
    caminho.setAttribute('d', 'm6 9 6 6 6-6');
    icone.append(caminho);
    botao.append(texto, icone);
    controle.after(botao);
  }
  controles.set(botao, controle);
  const texto = textoAtual || controle.selectedOptions[0]?.label || 'XXX';
  if (botao.firstChild?.textContent !== texto) botao.firstChild!.textContent = texto;
  botao.disabled = controle.disabled;
  botao.title = controle.title;
  botao.setAttribute('aria-label', `${controle.getAttribute('aria-label') || 'Selecionar'}: ${texto}`);
  botao.classList.toggle('seletor-tabela-pendente', texto === 'XXX');
  botao.classList.toggle('seletor-tabela-editavel', controle.hasAttribute('data-valor-livre'));
}

function copiarEstilos(documento: Document): () => void {
  const regras: string[] = [];
  const visitar = (lista: CSSRuleList) => {
    for (const regra of Array.from(lista)) {
      if (regra instanceof CSSStyleRule && regra.selectorText.includes('seletor-tabela')) regras.push(regra.cssText);
      else if ('cssRules' in regra) visitar((regra as CSSGroupingRule).cssRules);
    }
  };
  for (const folha of Array.from(document.styleSheets)) {
    try { visitar(folha.cssRules); } catch { continue; }
  }
  const estilo = documento.createElement('style');
  estilo.textContent = `:root {}\n${regras.join('\n')}`;
  documento.head.append(estilo);
  const regra = estilo.sheet?.cssRules[0];
  const atualizarTema = () => {
    if (!regra || !('style' in regra)) return;
    const origem = getComputedStyle(document.documentElement);
    for (const nome of ['spacing', 'radius', 'card', 'foreground', 'input', 'accent', 'ring', 'muted-foreground']) {
      (regra as CSSStyleRule).style.setProperty(`--${nome}`, origem.getPropertyValue(`--${nome}`));
    }
  };
  atualizarTema();
  const observador = new MutationObserver(atualizarTema);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => { observador.disconnect(); estilo.remove(); };
}

export function registrarSeletoresTabela(editor: Editor, aoAbrir: (sessao: SessaoSeletorTabela | null) => void): void {
  const documento = editor.getDoc();
  const janela = documento.defaultView;
  if (!janela) return;
  const limparEstilos = copiarEstilos(documento);
  const id = `seletor-${crypto.randomUUID()}`;
  const estilo = document.createElement('style');
  document.head.append(estilo);
  const indice = estilo.sheet?.insertRule(`[data-seletor-tabela-ancora="${id}"] {}`);
  const regra = indice === undefined ? null : estilo.sheet?.cssRules[indice];
  if (!(regra instanceof CSSStyleRule)) { estilo.remove(); limparEstilos(); return; }
  let encerrado = false;
  let ativo: { controle: HTMLSelectElement; botao: HTMLButtonElement; valor: string; assinatura: string; restaurar: boolean; rascunho: string; escolhido?: string } | null = null;
  const lerValor = (controle: HTMLSelectElement) => controle.getAttribute('data-valor-livre') ?? controle.value;
  const lerOpcoes = (controle: HTMLSelectElement) => Array.from(controle.options, opcao => ({
    valor: opcao.value, texto: opcao.label, desabilitada: opcao.disabled || opcao.hidden,
  }));
  const valido = (controle: HTMLSelectElement, botao: HTMLButtonElement) => !encerrado && !editor.removed && !editor.destroyed
    && !editorBloqueadoParaSeletores(editor) && !controle.disabled && !botao.disabled
    && editor.getBody().contains(controle) && editor.getBody().contains(botao) && controles.get(botao) === controle;
  const aplicarTextoLivre = (selecao: NonNullable<typeof ativo>, texto: string) => {
    const valor = texto.trim();
    const { controle, botao } = selecao;
    if (valor === selecao.valor || !valido(controle, botao) || lerValor(controle) !== selecao.valor
      || JSON.stringify(lerOpcoes(controle)) !== selecao.assinatura) return;
    controle.setAttribute('data-valor-livre', valor);
    controle.value = valor;
    controle.dispatchEvent(new janela.Event('change', { bubbles: true }));
  };
  const fechar = (restaurar = true, confirmarRascunho = false) => {
    const anterior = ativo;
    if (!anterior) return;
    ativo = null;
    fecharSeletorAtivo = null;
    anterior.restaurar = restaurar;
    if (confirmarRascunho && anterior.controle.hasAttribute('data-valor-livre')) aplicarTextoLivre(anterior, anterior.rascunho);
    anterior.botao.setAttribute('aria-expanded', 'false');
    anterior.botao.removeAttribute('aria-controls');
    aoAbrir(null);
  };
  const abrir = (botao: HTMLButtonElement) => {
    const controle = controles.get(botao);
    if (!controle || !valido(controle, botao)) return;
    fecharSeletorAtivo?.();
    const retangulo = botao.getBoundingClientRect();
    const frame = janela.frameElement?.getBoundingClientRect();
    regra.style.setProperty('left', `${retangulo.left + (frame?.left || 0) + (janela.frameElement?.clientLeft || 0)}px`);
    regra.style.setProperty('top', `${retangulo.top + (frame?.top || 0) + (janela.frameElement?.clientTop || 0)}px`);
    regra.style.setProperty('width', `${retangulo.width}px`);
    regra.style.setProperty('height', `${retangulo.height}px`);
    const opcoes = lerOpcoes(controle);
    const valor = lerValor(controle);
    const aceitaTextoLivre = controle.hasAttribute('data-valor-livre');
    const assinatura = JSON.stringify(opcoes);
    const selecao: NonNullable<typeof ativo> = { controle, botao, valor, assinatura, restaurar: false, rascunho: valor };
    ativo = selecao;
    fecharSeletorAtivo = () => fechar(false, true);
    botao.setAttribute('aria-expanded', 'true');
    botao.setAttribute('aria-controls', `${id}-lista`);
    aoAbrir({ id, valor, rotulo: controle.getAttribute('aria-label') || 'Selecionar', opcoes, aceitaTextoLivre,
      digitar: texto => { if (ativo === selecao) selecao.rascunho = texto; },
      fechar,
      concluirFechamento: () => {
        if (encerrado || !valido(controle, botao)) return;
        if (selecao.restaurar && !fecharSeletorAtivo) botao.focus({ preventScroll: true });
        const escolhido = selecao.escolhido;
        delete selecao.escolhido;
        if (escolhido === undefined || escolhido === valor) return;
        // O diálogo de preenchimento manual só pode abrir após a desmontagem do Radix.
        window.setTimeout(() => {
          if (!valido(controle, botao) || lerValor(controle) !== valor || JSON.stringify(lerOpcoes(controle)) !== assinatura) return;
          if (aceitaTextoLivre) controle.setAttribute('data-valor-livre', escolhido);
          controle.value = escolhido;
          controle.dispatchEvent(new janela.Event('change', { bubbles: true }));
        }, 0);
      },
      escolher: escolhido => {
        if (ativo !== selecao) return;
        if (!valido(controle, botao)
          || lerValor(controle) !== valor || JSON.stringify(lerOpcoes(controle)) !== assinatura
          || (!aceitaTextoLivre && !opcoes.some(opcao => opcao.valor === escolhido && !opcao.desabilitada))) { fechar(false); return; }
        if (aceitaTextoLivre) aplicarTextoLivre(selecao, escolhido);
        else selecao.escolhido = escolhido;
        fechar();
      },
    });
  };
  const ponteiro = (evento: PointerEvent) => {
    const alvo = evento.target;
    const botao = alvo instanceof janela.Element ? alvo.closest<HTMLButtonElement>(seletorAcionador) : null;
    if (!botao) { fechar(false, true); return; }
    if (evento.button !== 0) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    abrir(botao);
  };
  const teclado = (evento: KeyboardEvent) => {
    const alvo = evento.target;
    const botao = alvo instanceof janela.Element ? alvo.closest<HTMLButtonElement>(seletorAcionador) : null;
    if (!botao || evento.ctrlKey || evento.metaKey || !['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(evento.key)) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    abrir(botao);
  };
  const impedirClique = (evento: MouseEvent) => {
    if (evento.target instanceof janela.Element && evento.target.closest(seletorAcionador)) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
    }
  };
  const preservarFoco = (evento: FocusEvent) => {
    if (evento.target instanceof janela.Element && evento.target.closest(seletorAcionador)) evento.stopImmediatePropagation();
  };
  const conferir = () => {
    if (ativo && (!valido(ativo.controle, ativo.botao) || lerValor(ativo.controle) !== ativo.valor
      || JSON.stringify(lerOpcoes(ativo.controle)) !== ativo.assinatura)) fechar(false);
  };
  const fecharPorNavegacao = (evento: Event) => {
    if (evento.target instanceof Element && evento.target.closest('[data-seletor-tabela-lista]')) return;
    fechar(false, true);
  };
  const fecharPorEditor = () => fechar(false);
  documento.addEventListener('pointerdown', ponteiro, true);
  documento.addEventListener('keydown', teclado, true);
  documento.addEventListener('click', impedirClique, true);
  documento.addEventListener('mousedown', impedirClique, true);
  janela.addEventListener('focusin', preservarFoco, true);
  janela.addEventListener('scroll', fecharPorNavegacao, true);
  window.addEventListener('scroll', fecharPorNavegacao, true);
  window.addEventListener('resize', fecharPorNavegacao);
  const observador = new janela.MutationObserver(conferir);
  observador.observe(editor.getBody(), { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  registrarPreparacaoConteudo(editor, conferir, 20);
  editor.on('SwitchMode DisabledStateChange SetContent LoadContent Undo Redo', fecharPorEditor);
  editor.on('remove', () => {
    encerrado = true;
    fechar(false);
    observador.disconnect();
    estilo.remove();
    limparEstilos();
    documento.removeEventListener('pointerdown', ponteiro, true);
    documento.removeEventListener('keydown', teclado, true);
    documento.removeEventListener('click', impedirClique, true);
    documento.removeEventListener('mousedown', impedirClique, true);
    janela.removeEventListener('focusin', preservarFoco, true);
    janela.removeEventListener('scroll', fecharPorNavegacao, true);
    window.removeEventListener('scroll', fecharPorNavegacao, true);
    window.removeEventListener('resize', fecharPorNavegacao);
    editor.off('SwitchMode DisabledStateChange SetContent LoadContent Undo Redo', fecharPorEditor);
  });
}
