import type { Editor } from 'tinymce';
import { medirOperacaoEditorLaudo } from './desempenho-editor-laudo';

const sincronizadores = new WeakMap<Editor, { ler: () => string; pendente: () => boolean }>();

export function lerConteudoAtualEditorLaudo(editor: Editor): string {
  return sincronizadores.get(editor)?.ler() ?? editor.getContent();
}

export function sincronizacaoEditorLaudoPendente(editor: Editor): boolean {
  return sincronizadores.get(editor)?.pendente() ?? false;
}

export function agruparAlteracoesEditorLaudo(
  editor: Editor,
  aoSincronizar: (html: string) => void,
  aoMarcarPendente: () => void,
  estaPronto: () => boolean,
): void {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let pendente = false;
  let compondo = false;
  const cancelar = () => { clearTimeout(temporizador); temporizador = undefined; };
  const sincronizar = () => {
    cancelar();
    const emitir = pendente;
    pendente = false;
    const html = editor.getContent();
    if (emitir) aoSincronizar(html);
    return html;
  };
  const agendar = () => {
    if (editor.removed || editor.destroyed) return;
    if (!estaPronto()) return;
    pendente = true;
    cancelar();
    aoMarcarPendente();
    if (!compondo) temporizador = setTimeout(() => {
      if (!editor.removed && !editor.destroyed) sincronizar();
    }, 400);
  };
  sincronizadores.set(editor, { ler: sincronizar, pendente: () => pendente });
  editor.on('input change Undo Redo SetContent', agendar);
  editor.on('compositionstart', () => { compondo = true; cancelar(); });
  editor.on('compositionend', () => { compondo = false; agendar(); });
  editor.on('blur', () => { if (pendente && !compondo) sincronizar(); });
  editor.on('remove', () => { cancelar(); pendente = false; sincronizadores.delete(editor); });
}

export function instrumentarLeiturasEditorLaudo(editor: Editor, modoUnico: boolean): void {
  let restaurarDesfazer: (() => void) | undefined;
  editor.on('init', () => {
    const adicionarNivel = editor.undoManager.add.bind(editor.undoManager);
    editor.undoManager.add = (...argumentos) => medirOperacaoEditorLaudo(
      'criar_nivel_desfazer', () => adicionarNivel(...argumentos), { modoUnico },
    );
    restaurarDesfazer = () => { editor.undoManager.add = adicionarNivel; };
  });
  const inicios: number[] = [];
  editor.on('BeforeGetContent', () => { inicios.push(performance.now()); });
  editor.on('GetContent', evento => {
    const inicio = inicios.pop();
    if (inicio === undefined) return;
    window.ipcAPI?.desempenho?.registrar({
      origem: 'renderer', categoria: 'editor', evento: 'concluido',
      operacao: 'serializar_html_editor', duracaoMs: performance.now() - inicio,
      metadados: { modoUnico, bytesSaida: typeof evento.content === 'string' ? evento.content.length : 0 },
    });
  });
  editor.on('remove', () => { inicios.length = 0; restaurarDesfazer?.(); });
}

/** A referência só pode ser capturada depois que o TinyMCE estabiliza os src locais. */
export async function prepararInicializacaoEditorLaudo(
  editor: Editor,
  estaAtual: () => boolean,
  prepararConteudo: () => void,
): Promise<boolean> {
  if (!estaAtual() || editor.removed || editor.destroyed) return false;
  const imagens = await editor.uploadImages();
  if (!estaAtual() || editor.removed || editor.destroyed) return false;
  if (imagens.some(imagem => !imagem.status)) throw new Error('Não foi possível preparar as imagens do laudo.');
  prepararConteudo();
  return true;
}
