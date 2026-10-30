import type { Editor } from 'tinymce';
import { permiteEdicaoCampo } from './politica-edicao-conteudo';
import { encontrarCampoReservado, obterHtmlCampo, preencherCampoReservado } from './campos-reservados';
import { SELETOR_SELECAO_PONTUAL } from './adaptadores-conteudo-laudo';
import { editorBloqueadoParaSeletores } from './seletores-tabela-laudo';

export interface ContextoPreenchimentoB601 {
  quantidade: number;
  disponivel: boolean;
  aplicar: (valor: 'Prejudicado' | 'Ausente') => void;
  restaurarFoco: () => void;
}

const contextos = new WeakMap<Element, ContextoPreenchimentoB601 | null>();
const seletorManual = '[data-reservado="true"], [data-placeholder-personalizado-livre="true"]';

export function obterContextoPreenchimentoB601(alvo: EventTarget | null): ContextoPreenchimentoB601 | null {
  for (let elemento = alvo instanceof Element ? alvo : null; elemento; elemento = elemento.parentElement) {
    if (contextos.has(elemento)) {
      const contexto = contextos.get(elemento) ?? null;
      contextos.delete(elemento);
      return contexto;
    }
  }
  return null;
}

function obterCampo(celula: HTMLElement): HTMLElement | null {
  const tabela = celula.closest('table');
  const grupo = tabela?.closest('[data-b601-grupo="105"], [data-b601-grupo="101"]');
  if (!grupo || !tabela?.matches('[data-tabela-laudo="balistica"]') || celula.tagName !== 'TD'
    || celula.closest('thead, [data-placeholder-celula-fixa="true"], figure, [data-b601-complemento], [data-b601-fotos-origem]')) return null;
  const linha = celula.parentElement;
  const indice = linha ? Array.from(linha.children).indexOf(celula) : -1;
  const titulo = grupo.getAttribute('data-b601-grupo') === '105' ? linha?.firstElementChild?.textContent
    : tabela.querySelector('thead tr:last-child')?.children[indice]?.textContent;
  if (indice < 0 || /^(?:ID|Origem|Procedência)$/i.test(titulo?.trim() || '')) return null;
  if (celula.querySelector('[data-b601-origem-projetil], [data-campo-rep-pendente], [data-placeholder], img, table, figure')) return null;
  const seletor = celula.querySelector<HTMLElement>('[data-b601-campo-projetil], [data-b601-campo-estojo]');
  if (seletor?.querySelector('select')) return seletor.querySelector('select[data-valor-livre]') ? seletor : null;
  const manual = celula.querySelector<HTMLElement>(seletorManual);
  if (manual) return encontrarCampoReservado(manual);
  if (celula.querySelector('select, button, input, textarea, [data-mce-bogus="all"]')) return null;
  return seletor || celula;
}

export function registrarMenuPreenchimentoB601(editor: Editor, aoAlterar: (html: string) => void): void {
  const documento = editor.getDoc();
  const janela = documento.defaultView;
  if (!janela) return;
  const recipiente = editor.getContainer();
  let encerrado = false;
  let celulaClicada: HTMLElement | null | undefined;
  const ativo = () => !encerrado && !editor.removed && !editor.destroyed;
  const lerValor = (campo: HTMLElement) => campo.querySelector('[data-b601-campo-texto]')?.textContent?.trim()
    ?? obterHtmlCampo(campo);
  const criarContexto = (celula: HTMLElement | null): ContextoPreenchimentoB601 | null => {
    if (!celula || !obterCampo(celula)) return null;
    const selecionadas = Array.from(editor.getBody().querySelectorAll<HTMLElement>('td[data-mce-selected], th[data-mce-selected]'));
    const celulas = selecionadas.includes(celula) ? selecionadas : [celula];
    const campos = celulas.map(obterCampo);
    const valores = campos.map(campo => campo ? lerValor(campo) : null);
    const validar = () => ativo() && !editorBloqueadoParaSeletores(editor) && campos.every((campo, indice) => campo
      && editor.getBody().contains(celulas[indice]) && obterCampo(celulas[indice]) === campo
      && permiteEdicaoCampo(campo, false, campo.matches(SELETOR_SELECAO_PONTUAL))
      && lerValor(campo) === valores[indice]);
    const restaurarFoco = () => {
      if (!ativo()) return;
      if (editor.getBody().contains(celula)) celulaClicada = celula;
      editor.focus({ scrollToSelection: false });
      if (celulas.length === 1 && editor.getBody().contains(celula)
        && editor.selection.getStart().closest('td, th') !== celula) {
        editor.selection.select(celula, true);
        editor.selection.collapse(true);
      }
    };
    return {
      quantidade: celulas.length,
      disponivel: validar(),
      restaurarFoco,
      aplicar: valor => {
        if (!validar()) return;
        const alterados = campos.filter((campo): campo is HTMLElement => campo !== null
          && (campo.querySelector('[data-b601-campo-texto]') || campo).textContent?.trim() !== valor);
        if (!alterados.length) return;
        editor.undoManager.transact(() => {
          for (const campo of alterados) {
            const controle = campo.querySelector<HTMLSelectElement>('select[data-b601-campo-select][data-valor-livre]');
            if (controle) {
              controle.setAttribute('data-valor-livre', valor);
              controle.dispatchEvent(new janela.Event('change', { bubbles: true }));
            } else preencherCampoReservado(campo, valor);
          }
        });
        editor.nodeChanged();
        aoAlterar(editor.getContent());
      },
    };
  };
  const celulaDoAlvo = (alvo: EventTarget | null) => alvo instanceof janela.Element ? alvo.closest<HTMLElement>('td, th') : null;
  const registrarCelulaClicada = (evento: PointerEvent) => {
    celulaClicada = celulaDoAlvo(evento.target);
  };
  const limparCelulaClicada = () => { celulaClicada = undefined; };
  const sairDoEditor = () => { celulaClicada = null; };
  const prepararMenu = (evento: MouseEvent) => {
    contextos.set(recipiente, criarContexto(celulaDoAlvo(evento.target)));
  };
  const preservarSelecao = (evento: MouseEvent) => {
    const celula = celulaDoAlvo(evento.target);
    if (evento.button === 2 && celula?.hasAttribute('data-mce-selected') && obterCampo(celula)) evento.preventDefault();
  };
  const teclado = (evento: KeyboardEvent) => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Escape'].includes(evento.key)) limparCelulaClicada();
    const prejudicado = evento.ctrlKey && evento.shiftKey && !evento.altKey && evento.key.toLowerCase() === 'p';
    const ausente = evento.ctrlKey && evento.shiftKey && !evento.altKey && evento.key.toLowerCase() === 'a';
    if ((!prejudicado && !ausente) || evento.metaKey
      || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    const celula = celulaDoAlvo(evento.target) ?? (celulaClicada === undefined
      ? editor.selection.getStart().closest<HTMLElement>('td, th') : celulaClicada);
    if (celula && !editor.getBody().contains(celula)) { limparCelulaClicada(); return; }
    const contexto = criarContexto(celula);
    if (!contexto) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    contexto.aplicar(ausente ? 'Ausente' : 'Prejudicado');
    contexto.restaurarFoco();
  };
  documento.addEventListener('contextmenu', prepararMenu, true);
  documento.addEventListener('mousedown', preservarSelecao, true);
  documento.addEventListener('keydown', teclado, true);
  janela.addEventListener('pointerdown', registrarCelulaClicada, true);
  document.addEventListener('pointerdown', sairDoEditor, true);
  editor.on('SetContent LoadContent Undo Redo SwitchMode DisabledStateChange', limparCelulaClicada);
  editor.on('remove', () => {
    encerrado = true;
    contextos.delete(recipiente);
    documento.removeEventListener('contextmenu', prepararMenu, true);
    documento.removeEventListener('mousedown', preservarSelecao, true);
    documento.removeEventListener('keydown', teclado, true);
    janela.removeEventListener('pointerdown', registrarCelulaClicada, true);
    document.removeEventListener('pointerdown', sairDoEditor, true);
    editor.off('SetContent LoadContent Undo Redo SwitchMode DisabledStateChange', limparCelulaClicada);
  });
}
