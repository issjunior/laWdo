import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcularCorteFigura, pontoPercentualFigura, transformarFigura } from '../../renderer/components/laudo/EditorFiguraDialog';

describe('edição de figura', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('converte o ponteiro sobre uma prévia reduzida para porcentagens da imagem', () => {
    expect(pontoPercentualFigura(250, 160, { left: 100, top: 60, width: 300, height: 200 }))
      .toEqual({ x: 50, y: 50 });
    expect(pontoPercentualFigura(500, 10, { left: 100, top: 60, width: 300, height: 200 }))
      .toEqual({ x: 100, y: 0 });
  });

  it('cria o recorte por arraste em qualquer direção', () => {
    expect(calcularCorteFigura({
      tipo: 'criar', inicio: { x: 80, y: 70 },
      corteInicial: { x: 0, y: 0, largura: 100, altura: 100 },
    }, { x: 20, y: 10 })).toEqual({ x: 20, y: 10, largura: 60, altura: 60 });
  });

  it('move a seleção sem ultrapassar a imagem', () => {
    expect(calcularCorteFigura({
      tipo: 'mover', inicio: { x: 20, y: 20 },
      corteInicial: { x: 30, y: 40, largura: 40, altura: 30 },
    }, { x: 100, y: 100 })).toEqual({ x: 60, y: 70, largura: 40, altura: 30 });
  });

  it('redimensiona o retângulo mantendo o canto oposto fixo', () => {
    expect(calcularCorteFigura({
      tipo: 'redimensionar', inicio: { x: 20, y: 20 }, canto: 'superior-esquerdo',
      corteInicial: { x: 20, y: 20, largura: 50, altura: 40 },
    }, { x: 10, y: 30 })).toEqual({ x: 10, y: 30, largura: 60, altura: 30 });
  });

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
