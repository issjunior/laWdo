import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { useBuscaTextoLaudo } from '@/hooks/useBuscaTextoLaudo';
import { BarraBuscaLaudo } from '@/components/laudo/editor/BarraBuscaLaudo';

function criarEditor(texto: string) {
  const corpo = document.createElement('div');
  corpo.innerHTML = `<p>${texto}</p>`;
  corpo.style.overflowY = 'auto';
  Object.defineProperties(corpo, { clientHeight: { value: 400 }, scrollHeight: { value: 2000 } });
  corpo.scrollTo = vi.fn();
  const editor = { getBody: () => corpo, getContainer: () => corpo, on: vi.fn(), off: vi.fn() } as unknown as Editor;
  return { corpo, editor };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true,
    value: () => [{ top: 1000, height: 20, width: 100 }] });
});
afterEach(() => { vi.useRealTimers(); });

describe('controle da busca do laudo', () => {
  it('intercepta Ctrl+F fora de diálogos e limpa a busca ao trocar de laudo', () => {
    const opcoes = { laudoId: 'laudo-1', fontes: [], obterEditor: () => null, expandirSecao: vi.fn() };
    const { result, rerender } = renderHook(props => useBuscaTextoLaudo(props), { initialProps: opcoes });
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(result.current.aberta).toBe(true);
    act(() => result.current.fechar());
    const dialogo = document.createElement('div');
    dialogo.setAttribute('role', 'dialog'); document.body.append(dialogo);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(result.current.aberta).toBe(false);
    dialogo.remove();
    act(() => { result.current.abrir(); result.current.setTermo('termo'); });
    rerender({ ...opcoes, laudoId: 'laudo-2' });
    expect(result.current.aberta).toBe(false);
    expect(result.current.termo).toBe('');
  });

  it('busca entre seções, expande a seção e aguarda sua montagem sem alterar o conteúdo', () => {
    const primeira = criarEditor('cidade de <span contenteditable="false">TELÊMACO BORBA</span>');
    const segunda = criarEditor('cidade de TELÊMACO BORBA');
    let montada = false;
    const expandir = vi.fn();
    const fontes = [primeira, segunda].map(({ corpo }, indice) => ({ id: `secao-${indice}`, indice, criarCopia: () => corpo.cloneNode(true) as HTMLElement }));
    const obterEditor = (id: string) => id === 'secao-0' ? primeira.editor : montada ? segunda.editor : null;
    const anterior = primeira.corpo.innerHTML;
    const { result } = renderHook(() => useBuscaTextoLaudo({ laudoId: 'laudo-1', fontes, obterEditor, expandirSecao: expandir }));
    act(() => { result.current.abrir(); result.current.setTermo('cidade de TELÊMACO BORBA'); });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.total).toBe(2);
    act(() => result.current.navegar(1));
    act(() => vi.advanceTimersByTime(50));
    expect(expandir).toHaveBeenCalledWith(1);
    montada = true;
    act(() => vi.advanceTimersByTime(50));
    expect(segunda.corpo.scrollTo).toHaveBeenCalledWith({ top: 810, behavior: 'instant' });
    act(() => result.current.navegar(1));
    expect(result.current.atual).toBe(0);
    act(() => result.current.navegar(-1));
    expect(result.current.atual).toBe(1);
    act(() => result.current.fechar());
    expect(primeira.corpo.innerHTML).toBe(anterior);
    expect(primeira.editor.on).toHaveBeenCalled();
  });

  it('barra permite avançar, voltar e fechar pelo teclado', () => {
    const navegar = vi.fn(); const fechar = vi.fn();
    render(<BarraBuscaLaudo termo="cidade" atual={0} total={2} foco={1} onTermoChange={vi.fn()} onNavegar={navegar} onFechar={fechar} />);
    const entrada = screen.getByRole('textbox');
    expect(entrada).toHaveFocus();
    fireEvent.keyDown(entrada, { key: 'Enter' });
    expect(navegar).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(entrada, { key: 'Enter', shiftKey: true });
    expect(navegar).toHaveBeenLastCalledWith(-1);
    fireEvent.keyDown(entrada, { key: 'Escape' });
    expect(fechar).toHaveBeenCalled();
  });

  it('atualiza resultados após alterações do texto apresentado e limpa o realce ao fechar', async () => {
    const { corpo, editor } = criarEditor('<span contenteditable="false">TELÊMACO BORBA</span>');
    const registro = new Map<string, unknown>();
    const descritor = Object.getOwnPropertyDescriptor(CSS, 'highlights');
    Object.defineProperty(CSS, 'highlights', { configurable: true, value: registro });
    vi.stubGlobal('Highlight', class { constructor(..._intervalos: Range[]) {} });
    try {
      const fontes = [{ id: 'editor', indice: -1, criarCopia: () => corpo }];
      const obterEditor = () => editor;
      const { result, unmount } = renderHook(() => useBuscaTextoLaudo({ laudoId: 'laudo-1', fontes, obterEditor, expandirSecao: vi.fn() }));
      act(() => { result.current.abrir(); result.current.setTermo('TELÊMACO BORBA'); });
      act(() => vi.advanceTimersByTime(200));
      act(() => vi.advanceTimersByTime(32));
      expect(registro.has('laudo-busca')).toBe(true);
      const html = corpo.innerHTML;
      act(() => result.current.fechar());
      expect(registro.has('laudo-busca')).toBe(false);
      expect(corpo.innerHTML).toBe(html);
      act(() => result.current.abrir());
      act(() => vi.advanceTimersByTime(200));
      await act(async () => { corpo.querySelector('span')!.textContent = 'CURITIBA'; });
      act(() => vi.advanceTimersByTime(199));
      expect(result.current.total).toBe(1);
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.total).toBe(0);
      unmount();
    } finally {
      if (descritor) Object.defineProperty(CSS, 'highlights', descritor);
      else Reflect.deleteProperty(CSS, 'highlights');
      vi.unstubAllGlobals();
    }
  });

  it('prioriza o último clique sem rolar para ocorrências intermediárias e preserva o foco', () => {
    const { corpo, editor } = criarEditor('laudo laudo laudo');
    const fontes = [{ id: 'editor', indice: -1, criarCopia: () => corpo }];
    const obterEditor = () => editor;
    const { result } = renderHook(() => useBuscaTextoLaudo({ laudoId: 'laudo-1', fontes, obterEditor, expandirSecao: vi.fn() }));
    const entrada = document.createElement('input'); document.body.append(entrada); entrada.focus();
    act(() => { result.current.abrir(); result.current.setTermo('laudo'); });
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.navegar(1));
    act(() => result.current.navegar(1));
    expect(corpo.scrollTo).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(32));
    expect(corpo.scrollTo).toHaveBeenCalledTimes(1);
    expect(result.current.atual).toBe(2);
    expect(entrada).toHaveFocus();
    entrada.remove();
  });
});
