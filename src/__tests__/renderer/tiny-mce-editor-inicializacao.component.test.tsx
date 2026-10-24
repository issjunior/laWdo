import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor as EditorTinyMce } from 'tinymce';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';

interface PropriedadesEditorSimulado {
  onEditorChange: (html: string) => void;
  onInit?: unknown;
  init: { init_instance_callback: (editor: EditorTinyMce) => void; setup: (editor: EditorTinyMce) => void };
}

const estado = vi.hoisted(() => ({ propriedades: null as PropriedadesEditorSimulado | null }));
vi.mock('@tinymce/tinymce-react', () => ({
  Editor: (propriedades: PropriedadesEditorSimulado) => {
    estado.propriedades = propriedades;
    return null;
  },
}));

function criarEditor() {
  const corpo = document.createElement('div');
  corpo.innerHTML = '<p>Normalizado</p>';
  const container = document.createElement('div');
  const iframe = document.createElement('iframe');
  iframe.className = 'tox-edit-area__iframe';
  container.append(iframe);
  const editor = { getBody: () => corpo, getContainer: () => container, removed: false, destroyed: false };
  return { editor, instancia: editor as unknown as EditorTinyMce, iframe };
}

beforeEach(() => { estado.propriedades = null; });

describe('inicialização do editor TinyMCE', () => {
  it('distingue imagem real de dummy e preserva o clique na legenda', async () => {
    const aoClicarReal = vi.fn();
    const aoClicarDummy = vi.fn();
    const aoAlterar = vi.fn();
    const aoBuscar = vi.fn();
    const { rerender } = render(<TinyMceEditor onChange={aoAlterar} onFiguraRealClick={aoClicarReal} onDummyFigureClick={aoClicarDummy} onSolicitarBusca={aoBuscar} />);
    await waitFor(() => expect(estado.propriedades).not.toBeNull());
    const documento = document.implementation.createHTMLDocument();
    documento.body.innerHTML = '<figure class="laudo-figure" data-image-id="real"><img src="real.png"><figcaption>Legenda</figcaption></figure><figure class="laudo-figure" data-dummy="true" data-image-id="dummy"><img src="dummy.png"></figure><img src="outra.png">';
    const eventos = new Map<string, Array<() => void>>();
    const instancia = {
      on: (nome: string, callback: () => void) => eventos.set(nome, [...(eventos.get(nome) || []), callback]),
      off: vi.fn(), addCommand: vi.fn(),
      ui: { registry: { addButton: vi.fn(), addMenuButton: vi.fn() } },
      getDoc: () => documento, getBody: () => documento.body,
      undoManager: { ignore: (acao: () => void) => acao() },
      dom: { addStyle: vi.fn(), removeClass: vi.fn() },
    } as unknown as EditorTinyMce;
    act(() => { estado.propriedades!.init.setup(instancia); eventos.get('init')?.forEach(callback => callback()); });
    const atalhoBusca = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => documento.dispatchEvent(atalhoBusca));
    expect(atalhoBusca.defaultPrevented).toBe(true);
    expect(aoBuscar).toHaveBeenCalledTimes(1);
    const dialogo = document.createElement('div');
    dialogo.setAttribute('role', 'dialog'); document.body.append(dialogo);
    act(() => documento.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true })));
    expect(aoBuscar).toHaveBeenCalledTimes(1);
    dialogo.remove();
    const clicar = (elemento: Element) => fireEvent(elemento, new MouseEvent('click', { bubbles: true }));
    clicar(documento.querySelector('figcaption')!);
    clicar(documento.body.lastElementChild!);
    expect(aoClicarReal).not.toHaveBeenCalled();
    clicar(documento.querySelector('[data-image-id="real"] img')!);
    expect(aoClicarReal).toHaveBeenCalledTimes(1);
    clicar(documento.querySelector('[data-image-id="dummy"] img')!);
    expect(aoClicarDummy).toHaveBeenCalledExactlyOnceWith('dummy');
    const aoClicarAtualizado = vi.fn();
    rerender(<TinyMceEditor onChange={aoAlterar} onFiguraRealClick={aoClicarAtualizado} onDummyFigureClick={aoClicarDummy} />);
    clicar(documento.querySelector('[data-image-id="real"] img')!);
    expect(aoClicarAtualizado).toHaveBeenCalledTimes(1);
    expect(aoAlterar).not.toHaveBeenCalled();
    act(() => eventos.get('remove')?.forEach(callback => callback()));
  });

  it('aguarda a preparação assíncrona antes de tratar mudanças como edição', async () => {
    let concluir!: () => void;
    const preparacao = new Promise<void>(resolve => { concluir = resolve; });
    const aoAlterar = vi.fn();
    render(<TinyMceEditor initialValue="<p>Original</p>" onChange={aoAlterar} onEditorInit={() => preparacao} />);
    await waitFor(() => expect(estado.propriedades).not.toBeNull());
    const propriedades = estado.propriedades!;
    const { instancia, iframe } = criarEditor();
    act(() => propriedades.init.init_instance_callback(instancia));
    act(() => propriedades.onEditorChange('<p>Imagem normalizada</p>'));
    expect(aoAlterar).toHaveBeenLastCalledWith('<p>Imagem normalizada</p>', 'normalizacao-inicial');
    expect(iframe).not.toHaveAttribute('data-diagnostico-pronto');
    await act(async () => { concluir(); await preparacao; });
    expect(iframe).toHaveAttribute('data-diagnostico-pronto', 'true');
    act(() => propriedades.onEditorChange('<p>Editado</p>'));
    expect(aoAlterar).toHaveBeenLastCalledWith('<p>Editado</p>', 'usuario');
  });

  it('oferece recuperação quando a preparação falha sem liberar a edição', async () => {
    const aoAlterar = vi.fn();
    const { getByText } = render(<TinyMceEditor initialValue="<p>Original</p>" onChange={aoAlterar}
      onEditorInit={async () => { throw new Error('Falha na imagem'); }} />);
    await waitFor(() => expect(estado.propriedades).not.toBeNull());
    const propriedades = estado.propriedades!;
    const { instancia, iframe } = criarEditor();
    await act(async () => propriedades.init.init_instance_callback(instancia));
    expect(getByText('Não foi possível preparar o conteúdo do editor. Tente novamente.')).toBeInTheDocument();
    expect(iframe).not.toHaveAttribute('data-diagnostico-pronto');
    act(() => propriedades.onEditorChange('<p>Automático</p>'));
    expect(aoAlterar).toHaveBeenLastCalledWith('<p>Automático</p>', 'normalizacao-inicial');
  });

  it.each(['removido', 'desmontado'])('ignora a preparação concluída após editor %s', async situacao => {
    let concluir!: () => void;
    const preparacao = new Promise<void>(resolve => { concluir = resolve; });
    const { unmount } = render(<TinyMceEditor initialValue="<p>Original</p>" onChange={vi.fn()} onEditorInit={() => preparacao} />);
    await waitFor(() => expect(estado.propriedades).not.toBeNull());
    const { instancia, editor, iframe } = criarEditor();
    act(() => estado.propriedades!.init.init_instance_callback(instancia));
    if (situacao === 'removido') editor.removed = true;
    else unmount();
    await act(async () => { concluir(); await preparacao; });
    expect(iframe).not.toHaveAttribute('data-diagnostico-pronto');
  });

  it('libera as alterações depois do callback que conclui o carregamento inicial', async () => {
    const onChange = vi.fn();
    const onEditorInit = vi.fn();
    render(<TinyMceEditor editorId="editor-inicializacao" initialValue="<p>Original</p>" onChange={onChange} onEditorInit={onEditorInit} />);
    await waitFor(() => expect(estado.propriedades).not.toBeNull());
    const propriedades = estado.propriedades!;
    expect(propriedades.onInit).toBeUndefined();
    act(() => propriedades.onEditorChange('<p>Normalizado</p>'));
    expect(onChange).toHaveBeenLastCalledWith('<p>Normalizado</p>', 'normalizacao-inicial');
    expect(onEditorInit).not.toHaveBeenCalled();

    const corpo = document.createElement('div');
    corpo.innerHTML = '<p>Normalizado</p>';
    const container = document.createElement('div');
    const iframe = document.createElement('iframe');
    iframe.className = 'tox-edit-area__iframe';
    container.append(iframe);
    const editor = { getBody: () => corpo, getContainer: () => container } as unknown as EditorTinyMce;
    act(() => propriedades.init.init_instance_callback(editor));
    expect(onEditorInit).toHaveBeenCalledWith(editor);
    expect(iframe.getAttribute('data-diagnostico-pronto')).toBe('true');
    act(() => propriedades.onEditorChange('<p>Editado</p>'));
    expect(onChange).toHaveBeenLastCalledWith('<p>Editado</p>', 'usuario');
  });
});
