import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorFiguraDialog, type AjustesFigura } from '../../renderer/components/laudo/EditorFiguraDialog';

describe('recorte visual de figura', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('seleciona por arraste na prévia reduzida e aplica o corte à imagem original', async () => {
    class ImagemSimulada {
      width = 600;
      height = 400;
      src = '';
      async decode() { return undefined; }
    }
    vi.stubGlobal('Image', ImagemSimulada);
    const contexto = {
      fillStyle: '', fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    const aplicar = vi.fn<(dataUri: string, ajustes: AjustesFigura) => void>();
    render(<EditorFiguraDialog aberto origem="data:image/jpeg;base64,AAAA" onAbertoChange={vi.fn()} onAplicar={aplicar} />);

    const selecao = screen.getByLabelText('Área de recorte da figura');
    vi.spyOn(selecao, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 100, y: 60, width: 300, height: 200 }));
    Object.defineProperty(selecao, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(selecao, 'releasePointerCapture', { value: vi.fn() });
    fireEvent.pointerDown(selecao, { button: 0, pointerId: 1, clientX: 130, clientY: 80 });
    fireEvent.pointerMove(selecao, { pointerId: 1, clientX: 280, clientY: 180 });
    fireEvent.pointerUp(selecao, { pointerId: 1, clientX: 280, clientY: 180 });

    expect(screen.getByRole('button', { name: 'Selecionar imagem inteira' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar ajustes' }));
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith('data:image/png;base64,AAAA', expect.objectContaining({
      corte: { x: 10, y: 10, largura: 50, altura: 50 },
    })));
    expect(contexto.drawImage).toHaveBeenLastCalledWith(expect.anything(), 60, 40, 300, 200, 0, 0, 300, 200);
  });
});
