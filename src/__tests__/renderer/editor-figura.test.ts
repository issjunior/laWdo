import { afterEach, describe, expect, it, vi } from 'vitest';
import { transformarFigura } from '../../renderer/components/laudo/EditorFiguraDialog';

describe('edição de figura', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gira e recorta a partir da imagem-base preservando fundo branco', async () => {
    const original = globalThis.Image;
    class ImagemSimulada {
      width = 100;
      height = 50;
      src = '';
      async decode() { return undefined; }
    }
    vi.stubGlobal('Image', ImagemSimulada);
    const contexto = {
      fillStyle: '', fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
    };
    const obterContexto = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as unknown as CanvasRenderingContext2D);
    const gerarDataUri = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    const resultado = await transformarFigura('data:image/jpeg;base64,AAAA', {
      angulo: 90, espelharHorizontal: true, espelharVertical: false,
      corte: { x: 10, y: 20, largura: 50, altura: 60 },
    });
    expect(resultado).toBe('data:image/png;base64,AAAA');
    expect(contexto.fillStyle).toBe('#ffffff');
    expect(contexto.scale).toHaveBeenCalledWith(-1, 1);
    expect(contexto.drawImage).toHaveBeenCalledWith(expect.anything(), 5, 20, 25, 60, 0, 0, 25, 60);
    obterContexto.mockRestore();
    gerarDataUri.mockRestore();
    vi.stubGlobal('Image', original);
  });
});
