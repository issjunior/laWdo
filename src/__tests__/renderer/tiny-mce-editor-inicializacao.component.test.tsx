import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

describe('inicialização do editor TinyMCE', () => {
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
