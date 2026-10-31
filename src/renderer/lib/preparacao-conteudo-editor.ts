import type { Editor } from 'tinymce';

type Preparacao = { prioridade: number; executar: () => void };
const sessoes = new WeakMap<Editor, { preparar: Set<Preparacao>; agendar: () => void }>();

export function registrarPreparacaoConteudo(editor: Editor, executar: () => void, prioridade = 10): () => void {
  let sessao = sessoes.get(editor);
  if (!sessao) {
    const preparar = new Set<Preparacao>();
    const janela = editor.getDoc().defaultView;
    let quadro: number | undefined;
    const agendar = () => {
      if (!janela || quadro !== undefined || editor.removed || editor.destroyed) return;
      quadro = janela.requestAnimationFrame(() => {
        quadro = undefined;
        if (editor.removed || editor.destroyed) return;
        [...preparar].sort((a, b) => a.prioridade - b.prioridade).forEach(item => item.executar());
      });
    };
    const eventos = 'SetContent LoadContent Undo Redo SwitchMode DisabledStateChange PlaceholdersAplicados ConteudoInterativoAlterado';
    editor.on(eventos, agendar);
    editor.on('remove', () => {
      if (quadro !== undefined) janela?.cancelAnimationFrame(quadro);
      editor.off(eventos, agendar);
      preparar.clear();
      sessoes.delete(editor);
    });
    sessao = { preparar, agendar };
    sessoes.set(editor, sessao);
  }
  const registro = { prioridade, executar };
  sessao.preparar.add(registro);
  return sessao.agendar;
}
