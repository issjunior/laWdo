import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor as EditorTinyMce } from 'tinymce';
import { TinyMceEditor } from '@/components/editor/TinyMceEditor';

interface PropriedadesEditorSimulado {
  onEditorChange: (html: string) => void;
  onInit?: unknown;
  init: { init_instance_callback: (editor: EditorTinyMce) => void };
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
