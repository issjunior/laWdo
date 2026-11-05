import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    const selecao = await screen.findByLabelText('Área de recorte da figura');
    vi.spyOn(selecao, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 100, y: 60, width: 300, height: 200 }));
    Object.defineProperty(selecao, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(selecao, 'releasePointerCapture', { value: vi.fn() });
    fireEvent.pointerDown(selecao, { button: 0, pointerId: 1, clientX: 130, clientY: 80 });
    fireEvent.pointerMove(selecao, { pointerId: 1, clientX: 280, clientY: 180 });
    fireEvent.pointerUp(selecao, { pointerId: 1, clientX: 280, clientY: 180 });

    expect(screen.getByRole('button', { name: 'Remover recorte' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aplicar ajustes' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar ajustes' }));
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith('data:image/png;base64,AAAA', expect.objectContaining({
      corte: { x: 10, y: 10, largura: 50, altura: 50 },
    })));
    expect(contexto.drawImage).toHaveBeenLastCalledWith(expect.anything(), 60, 40, 300, 200, 0, 0, 300, 200);
  });

  it('reabre com o giro salvo e permite restaurar a orientação original', async () => {
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
    const ajustes: AjustesFigura = { angulo: 90, espelharHorizontal: true, espelharVertical: false,
      corte: { x: 10, y: 5, largura: 70, altura: 85 } };
    render(<EditorFiguraDialog aberto origem="data:image/jpeg;base64,AAAA" ajustesIniciais={ajustes}
      onAbertoChange={vi.fn()} onAplicar={aplicar} />);

    expect(screen.getByRole('spinbutton', { name: 'Ângulo (graus)' })).toHaveValue(90);
    expect(screen.getByRole('button', { name: 'Remover recorte' })).toBeTruthy();
    await waitFor(() => expect(contexto.rotate).toHaveBeenCalledWith(Math.PI / 2));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Prévia da figura antes do recorte' }).getAttribute('src')).toBe('data:image/png;base64,AAAA'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aplicar ajustes' })); });
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith('data:image/png;base64,AAAA', ajustes));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restaurar imagem' })); });
    expect(screen.getByRole('spinbutton', { name: 'Ângulo (graus)' })).toHaveValue(0);
    expect(screen.queryByRole('button', { name: 'Remover recorte' })).toBeNull();
  });

  it('normaliza a rotação e permite criar, mover, formatar e excluir textos sem decodificar novamente', async () => {
    const decodificar = vi.fn(async () => undefined);
    class ImagemSimulada { width = 600; height = 400; src = ''; decode = decodificar; }
    vi.stubGlobal('Image', ImagemSimulada);
    const contexto = { fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
      measureText: vi.fn((texto: string) => ({ width: texto.length * 7 })), strokeText: vi.fn(), fillText: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    const aplicar = vi.fn();
    const fechar = vi.fn();
    const iniciais: AjustesFigura = { angulo: -270, espelharHorizontal: false, espelharVertical: false, corte: { x: 0, y: 0, largura: 100, altura: 100 } };
    render(<EditorFiguraDialog aberto origem="foto" ajustesIniciais={iniciais} onAplicar={aplicar} onAbertoChange={fechar} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aplicar ajustes' })).toBeEnabled());
    expect(screen.getByRole('spinbutton', { name: 'Ângulo (graus)' })).toHaveValue(90);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '90');
    fireEvent.click(screen.getByRole('button', { name: '90° à direita' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-12.5' } });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '-12.5');
    fireEvent.click(screen.getByRole('button', { name: 'Horizontal' }));
    expect(screen.getByRole('button', { name: 'Horizontal' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Texto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar texto' }));
    expect(screen.getByRole('textbox', { name: /Conteúdo do texto/ })).toHaveFocus();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Amostra\n01' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Cor' }), { target: { value: 'vermelho' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tamanho' }), { target: { value: 'grande' } });
    const anotacao = await screen.findByRole('button', { name: 'Mover texto 1' });
    const superficie = screen.getByLabelText('Textos sobre a figura');
    vi.spyOn(superficie, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 200 }));
    Object.defineProperty(anotacao, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(anotacao, 'releasePointerCapture', { value: vi.fn() });
    fireEvent.pointerDown(anotacao, { button: 0, pointerId: 1, clientX: 150, clientY: 100 });
    fireEvent.pointerUp(anotacao, { pointerId: 1, clientX: 180, clientY: 120 });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar ajustes' }));
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      angulo: -12.5, espelharHorizontal: true,
      textos: [expect.objectContaining({ conteudo: 'Amostra\n01', x: 60, y: 60, tamanho: 'grande', cor: 'vermelho' })],
    })));
    expect(decodificar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir texto' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(fechar).toHaveBeenCalledWith(false);
    expect(aplicar).toHaveBeenCalledTimes(1);
  });

  it('reabre textos salvos e restaura a imagem sem manter anotações', async () => {
    class ImagemSimulada { width = 600; height = 400; src = ''; async decode() { return undefined; } }
    vi.stubGlobal('Image', ImagemSimulada);
    const contexto = { fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
      measureText: vi.fn(() => ({ width: 30 })), strokeText: vi.fn(), fillText: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    const aplicar = vi.fn();
    render(<EditorFiguraDialog aberto origem="foto" onAplicar={aplicar} onAbertoChange={vi.fn()} ajustesIniciais={{
      angulo: 0, espelharHorizontal: false, espelharVertical: false, corte: { x: 0, y: 0, largura: 100, altura: 100 },
      textos: [{ id: 'salvo', conteudo: 'Rótulo salvo', x: 50, y: 50, tamanho: 'medio', cor: 'branco' }],
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Texto (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Texto 1' }));
    expect(screen.getByRole('textbox')).toHaveValue('Rótulo salvo');
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar imagem' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aplicar ajustes' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar ajustes' }));
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith(expect.any(String), expect.not.objectContaining({ textos: expect.anything() })));
  });
});
