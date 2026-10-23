import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { agruparAlteracoesEditorLaudo, instrumentarLeiturasEditorLaudo, lerConteudoAtualEditorLaudo, sincronizacaoEditorLaudoPendente } from '@/lib/sincronizacao-editor-laudo';

function criarEditor() {
  const ouvintes = new Map<string, Array<(evento: Record<string, unknown>) => void>>();
  const emitir = (nome: string, evento: Record<string, unknown> = {}) => ouvintes.get(nome)?.forEach(ouvinte => ouvinte(evento));
  const editor = {
    removed: false, destroyed: false,
    getContent: vi.fn(() => '<p>Conteúdo atual com figura</p>'),
    undoManager: { add: vi.fn() },
    on: (nomes: string, ouvinte: (evento: Record<string, unknown>) => void) => {
      for (const nome of nomes.split(' ')) ouvintes.set(nome, [...(ouvintes.get(nome) ?? []), ouvinte]);
    },
  };
  return { editor, instancia: editor as unknown as Editor, emitir };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('sincronização agrupada do laudo', () => {
  it('digita continuamente sem serializar e publica o conteúdo somente após a pausa', () => {
    vi.useFakeTimers();
    const { editor, instancia, emitir } = criarEditor();
    const publicar = vi.fn();
    const pendente = vi.fn();
    agruparAlteracoesEditorLaudo(instancia, publicar, pendente, () => true);
    for (let indice = 0; indice < 20; indice++) { emitir('input'); vi.advanceTimersByTime(100); }
    expect(editor.getContent).not.toHaveBeenCalled();
    expect(pendente).toHaveBeenCalledTimes(20);
    vi.advanceTimersByTime(300);
    expect(editor.getContent).toHaveBeenCalledTimes(1);
    expect(publicar).toHaveBeenCalledWith('<p>Conteúdo atual com figura</p>');
  });

  it('obtém o conteúdo antes do temporizador para salvar ou trocar de modo, sem republicar depois', () => {
    vi.useFakeTimers();
    const { editor, instancia, emitir } = criarEditor();
    const publicar = vi.fn();
    agruparAlteracoesEditorLaudo(instancia, publicar, vi.fn(), () => true);
    emitir('input');
    expect(lerConteudoAtualEditorLaudo(instancia)).toBe('<p>Conteúdo atual com figura</p>');
    vi.advanceTimersByTime(1000);
    expect(editor.getContent).toHaveBeenCalledTimes(1);
    expect(publicar).toHaveBeenCalledTimes(1);
    emitir('input');
    vi.advanceTimersByTime(400);
    expect(publicar).toHaveBeenCalledTimes(2);
  });

  it('aguarda o fim da composição de texto e cancela tarefas do editor removido', () => {
    vi.useFakeTimers();
    const { editor, instancia, emitir } = criarEditor();
    const publicar = vi.fn();
    agruparAlteracoesEditorLaudo(instancia, publicar, vi.fn(), () => true);
    emitir('compositionstart'); emitir('input'); emitir('blur');
    vi.advanceTimersByTime(1000);
    expect(editor.getContent).not.toHaveBeenCalled();
    expect(sincronizacaoEditorLaudoPendente(instancia)).toBe(true);
    emitir('compositionend');
    vi.advanceTimersByTime(400);
    expect(publicar).toHaveBeenCalledTimes(1);
    expect(sincronizacaoEditorLaudoPendente(instancia)).toBe(false);
    emitir('input'); emitir('remove');
    vi.advanceTimersByTime(1000);
    expect(publicar).toHaveBeenCalledTimes(1);
  });

  it('preserva uma nova edição feita enquanto a versão anterior está sendo salva', () => {
    vi.useFakeTimers();
    const { editor, instancia, emitir } = criarEditor();
    const publicar = vi.fn();
    agruparAlteracoesEditorLaudo(instancia, publicar, vi.fn(), () => true);
    emitir('input');
    const enviadoParaSalvar = lerConteudoAtualEditorLaudo(instancia);
    editor.getContent.mockReturnValue('<p>Edição durante o salvamento</p>');
    emitir('input');
    expect(lerConteudoAtualEditorLaudo(instancia)).not.toBe(enviadoParaSalvar);
    vi.advanceTimersByTime(1000);
    expect(publicar).toHaveBeenLastCalledWith('<p>Edição durante o salvamento</p>');
    expect(publicar).toHaveBeenCalledTimes(2);
  });

  it('não marca normalização inicial como edição e conclui alterações ao perder foco', () => {
    vi.useFakeTimers();
    const { instancia, emitir } = criarEditor();
    const publicar = vi.fn(); const pendente = vi.fn();
    let pronto = false;
    agruparAlteracoesEditorLaudo(instancia, publicar, pendente, () => pronto);
    emitir('SetContent'); emitir('blur');
    expect(pendente).not.toHaveBeenCalled();
    expect(publicar).not.toHaveBeenCalled();
    pronto = true;
    emitir('input'); emitir('blur');
    expect(publicar).toHaveBeenCalledTimes(1);
  });

  it('instrumenta leituras sem registrar o texto do laudo', () => {
    const registrar = vi.fn();
    const anterior = Object.getOwnPropertyDescriptor(window.ipcAPI, 'desempenho');
    Object.defineProperty(window.ipcAPI, 'desempenho', { value: { registrar }, configurable: true });
    try {
      const { editor, instancia, emitir } = criarEditor();
      const adicionarNivel = editor.undoManager.add;
      adicionarNivel.mockReturnValue({ content: 'CONTEUDO_UNDO_PRIVADO' });
      instrumentarLeiturasEditorLaudo(instancia, true);
      expect(editor.undoManager.add).toBe(adicionarNivel);
      emitir('init');
      emitir('BeforeGetContent'); emitir('GetContent', { content: 'sigiloso' });
      expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ operacao: 'serializar_html_editor', metadados: { modoUnico: true, bytesSaida: 8 } }));
      expect(JSON.stringify(registrar.mock.calls)).not.toContain('sigiloso');
      expect(instancia.undoManager.add()).toEqual({ content: 'CONTEUDO_UNDO_PRIVADO' });
      expect(adicionarNivel).toHaveBeenCalledTimes(1);
      expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ operacao: 'criar_nivel_desfazer' }));
      expect(JSON.stringify(registrar.mock.calls)).not.toContain('CONTEUDO_UNDO_PRIVADO');
    } finally {
      if (anterior) Object.defineProperty(window.ipcAPI, 'desempenho', anterior);
      else Reflect.deleteProperty(window.ipcAPI, 'desempenho');
    }
  });
});
