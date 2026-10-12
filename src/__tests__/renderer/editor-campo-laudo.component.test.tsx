import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorCampoLaudo } from '../../renderer/components/laudo/EditorCampoLaudo';

vi.mock('@tinymce/tinymce-react', () => ({
  Editor: ({ initialValue, onEditorChange }: { initialValue: string; onEditorChange: (html: string) => void }) => (
    <textarea aria-label="Editor do campo" data-valor-inicial={initialValue} defaultValue={initialValue} onChange={evento => onEditorChange(evento.target.value)} />
  ),
}));

describe('editor de texto personalizado do laudo', () => {
  it('mantém o valor inicial fixo durante a digitação e usa novo valor ao reabrir', () => {
    const alterar = vi.fn();
    const { rerender, unmount } = render(<EditorCampoLaudo valor="Texto inicial" onChange={alterar} />);
    const editor = screen.getByRole('textbox', { name: 'Editor do campo' });

    fireEvent.change(editor, { target: { value: 'Texto <strong>alterado</strong>' } });
    expect(alterar).toHaveBeenCalledWith('Texto <strong>alterado</strong>');

    rerender(<EditorCampoLaudo valor="Texto <strong>alterado</strong>" onChange={alterar} />);
    expect(editor.getAttribute('data-valor-inicial')).toBe('Texto inicial');

    unmount();
    render(<EditorCampoLaudo valor="Outro campo" onChange={alterar} />);
    expect(screen.getByRole('textbox', { name: 'Editor do campo' }).getAttribute('data-valor-inicial')).toBe('Outro campo');
  });
});
