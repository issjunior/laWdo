import type { Editor } from 'tinymce';
import type { EstadoCorretor, SugestoesCorretor } from '@shared/types/corretor.types';
import { permiteEdicaoCampo } from './politica-edicao-conteudo';

export interface ContextoCorrecao extends SugestoesCorretor {
  aplicar: (sugestao: string) => boolean;
  restaurarFoco: () => void;
}

const contextos = new Map<string, ContextoCorrecao>();
const EVENTO_ESTADO = 'lawdo:corretor-alterado';
const SELETOR_PARAGRAFO = 'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, pre, div';

export function notificarEstadoCorretor(estado: EstadoCorretor): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ESTADO, { detail: estado.ativo }));
}

export function observarEstadoCorretor(aoAlterar: () => void): () => void {
  window.addEventListener(EVENTO_ESTADO, aoAlterar);
  return () => window.removeEventListener(EVENTO_ESTADO, aoAlterar);
}

export function obterContextoCorrecao(editorId: string): ContextoCorrecao | null {
  return contextos.get(editorId) ?? null;
}

function capturarPalavraCorretor(editor: Editor, evento: MouseEvent): Range | null {
  const documento = editor.getDoc();
  const documentoComCursor = documento as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const cursor = documentoComCursor.caretRangeFromPoint?.(evento.clientX, evento.clientY);
  if (!cursor || cursor.startContainer.nodeType !== 3) return null;
  const bloco = cursor.startContainer.parentElement?.closest(SELETOR_PARAGRAFO) ?? editor.getBody();
  const trechos: Array<{ no: Node; inicio: number; fim: number }> = [];
  let texto = '';
  const percurso = documento.createTreeWalker(bloco, 1 | 4);
  for (let no = percurso.nextNode(); no; no = percurso.nextNode()) {
    if (no.nodeType === 1) {
      if ((no as Element).tagName === 'BR') texto += ' ';
      continue;
    }
    if ((no.parentElement?.closest(SELETOR_PARAGRAFO) ?? editor.getBody()) !== bloco) { texto += ' '; continue; }
    const inicio = texto.length;
    texto += no.textContent ?? '';
    trechos.push({ no, inicio, fim: texto.length });
  }
  const trechoCursor = trechos.find(trecho => trecho.no === cursor.startContainer);
  if (!trechoCursor) return null;
  const posicao = trechoCursor.inicio + cursor.startOffset;
  for (const ocorrencia of texto.matchAll(/[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu)) {
    const inicio = ocorrencia.index;
    const fim = inicio + ocorrencia[0].length;
    if (posicao >= inicio && posicao <= fim) {
      const intervalo = documento.createRange();
      const primeiro = trechos.find(trecho => inicio >= trecho.inicio && inicio < trecho.fim);
      const ultimo = trechos.find(trecho => fim > trecho.inicio && fim <= trecho.fim);
      if (!primeiro || !ultimo) return null;
      intervalo.setStart(primeiro.no, inicio - primeiro.inicio);
      intervalo.setEnd(ultimo.no, fim - ultimo.inicio);
      return intervalo;
    }
  }
  return null;
}

function podeCorrigir(editor: Editor, intervalo: Range): boolean {
  if (editor.mode.isReadOnly() || editor.options?.get('disabled') === true) return false;
  const permitido = (no: Node) => {
    const elemento = no.parentElement;
    return Boolean(elemento && editor.getBody().contains(elemento)
      && elemento.closest('[contenteditable]')?.getAttribute('contenteditable') !== 'false'
      && !elemento.closest('[data-placeholder], [data-placeholder-personalizado-html], [data-placeholder-personalizado-livre="true"], [data-reservado="true"], [data-mce-bogus]')
      && permiteEdicaoCampo(elemento, false));
  };
  if (!permitido(intervalo.startContainer) || !permitido(intervalo.endContainer)) return false;
  const percurso = editor.getDoc().createTreeWalker(intervalo.commonAncestorContainer, 4);
  for (let no = percurso.nextNode(); no; no = percurso.nextNode()) {
    if (intervalo.intersectsNode(no) && !permitido(no)) return false;
  }
  return true;
}

export function registrarCorretorEditor(editor: Editor, encaminharMenu: (evento: MouseEvent) => void = () => undefined): void {
  if (!window.ipcAPI?.corretor) return;
  let ativo = false;
  let encerrado = false;
  let revisao = 0;
  let pendente: { intervalo: Range; textoOriginal: string | null } | null = null;
  let eventoPendente: MouseEvent | null = null;
  let prazoMenu: ReturnType<typeof setTimeout> | undefined;
  const abrirMenu = () => {
    if (prazoMenu) clearTimeout(prazoMenu);
    const evento = eventoPendente;
    eventoPendente = null;
    if (evento && !encerrado) encaminharMenu(evento);
  };
  const limpar = () => {
    pendente = null;
    contextos.delete(editor.id);
  };
  const atualizar = (evento: Event) => {
    if (!(evento instanceof CustomEvent) || typeof evento.detail !== 'boolean') return;
    revisao++;
    ativo = evento.detail;
    limpar();
  };
  window.addEventListener(EVENTO_ESTADO, atualizar);
  const revisaoInicial = revisao;
  void window.ipcAPI.corretor.obter().then(resposta => {
    if (!encerrado && revisao === revisaoInicial && resposta.success) ativo = resposta.data.ativo;
  }).catch(() => undefined);

  const capturar = (evento: MouseEvent) => {
    limpar();
    if (prazoMenu) clearTimeout(prazoMenu);
    eventoPendente = evento;
    // Abrir o menu antes da resposta nativa faz o Chromium inspecionar a sobreposição, não o texto.
    prazoMenu = setTimeout(abrirMenu, 750);
    if (!ativo) return;
    const intervalo = capturarPalavraCorretor(editor, evento);
    if (!intervalo || !podeCorrigir(editor, intervalo)) return;
    pendente = { intervalo, textoOriginal: intervalo.startContainer.textContent };
  };
  const cancelarSugestoes = window.ipcAPI.corretor.onSugestoes(consulta => {
    if (!eventoPendente || encerrado) return;
    if (!pendente || !ativo) { abrirMenu(); return; }
    const { intervalo, textoOriginal } = pendente;
    pendente = null;
    const palavra = intervalo.toString();
    if (!palavra || palavra !== consulta.palavra || !podeCorrigir(editor, intervalo)) { abrirMenu(); return; }
    const no = intervalo.startContainer;
    const revisaoConsulta = revisao;
    const contexto: ContextoCorrecao = {
      ...consulta,
      palavra,
      restaurarFoco: () => { if (!encerrado) editor.focus({ scrollToSelection: false }); },
      aplicar: sugestao => {
        if (encerrado || !ativo || revisao !== revisaoConsulta || contextos.get(editor.id) !== contexto
          || !consulta.sugestoes.includes(sugestao) || !no.isConnected
          || no.textContent !== textoOriginal || intervalo.toString() !== palavra || !podeCorrigir(editor, intervalo)) return false;
        editor.undoManager.transact(() => {
          editor.selection.setRng(intervalo);
          editor.insertContent(editor.dom.encode(sugestao));
        });
        editor.nodeChanged();
        editor.dispatch('change');
        contextos.delete(editor.id);
        return true;
      },
    };
    contextos.set(editor.id, contexto);
    abrirMenu();
  });
  const documento = editor.getDoc();
  documento.addEventListener('contextmenu', capturar);
  editor.on('remove', () => {
    encerrado = true;
    eventoPendente = null;
    if (prazoMenu) clearTimeout(prazoMenu);
    limpar();
    cancelarSugestoes();
    documento.removeEventListener('contextmenu', capturar);
    window.removeEventListener(EVENTO_ESTADO, atualizar);
  });
}
