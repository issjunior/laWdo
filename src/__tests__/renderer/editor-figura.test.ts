import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcularCorteFigura, pontoPercentualFigura, transformarFigura } from '../../renderer/components/laudo/EditorFiguraDialog';
import { normalizarAnguloFigura, renderizarFigura } from '../../renderer/lib/renderizacao-figura';
import { ajustesFiguraValidos } from '../../shared/types/imagem-laudo.types';

describe('edição de figura', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([[-270, 90], [450, 90], [720, 0], [-450, -90], [180, 180], [-180, -180], [10.25, 10.3]])('normaliza %s graus para %s', (entrada, esperado) => {
    expect(normalizarAnguloFigura(entrada)).toBe(esperado);
  });

  it('aceita ajustes antigos e rejeita textos inválidos sem confiar no JSON', () => {
    const base = { angulo: 0, espelharHorizontal: false, espelharVertical: false, corte: { x: 0, y: 0, largura: 100, altura: 100 } };
    const texto = { id: 'texto', conteudo: 'Detalhe\nIdentificado', x: 50, y: 50, tamanho: 'medio', cor: 'branco' };
    expect(ajustesFiguraValidos(base)).toBe(true);
    expect(ajustesFiguraValidos({ ...base, textos: [texto] })).toBe(true);
    for (const alteracoes of [{ x: NaN }, { y: 101 }, { conteudo: 'a'.repeat(501) }, { cor: 'verde' }, { tamanho: 'enorme' }, { id: '' }]) {
      expect(ajustesFiguraValidos({ ...base, textos: [{ ...texto, ...alteracoes }] })).toBe(false);
    }
    expect(ajustesFiguraValidos({ ...base, textos: [texto, texto] })).toBe(false);
    expect(ajustesFiguraValidos({ ...base, textos: Array.from({ length: 21 }, (_, indice) => ({ ...texto, id: String(indice) })) })).toBe(false);
  });

  it('limita o canvas de prévia sem reduzir a saída original', () => {
    const contexto = { fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn() };
    const simular = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as unknown as CanvasRenderingContext2D);
    const imagem = new Image();
    imagem.width = 4000;
    imagem.height = 2000;
    const ajustes = { angulo: 0, espelharHorizontal: false, espelharVertical: false, corte: { x: 0, y: 0, largura: 100, altura: 100 } };
    expect(renderizarFigura(imagem, ajustes, 1280).width).toBe(1280);
    expect(renderizarFigura(imagem, ajustes).width).toBe(4000);
    simular.mockRestore();
  });

  it('compõe texto multilinha depois do giro, espelhamento e recorte', async () => {
    class ImagemSimulada { width = 1000; height = 800; src = ''; async decode() { return undefined; } }
    vi.stubGlobal('Image', ImagemSimulada);
    const contexto = { fillRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
      measureText: vi.fn((texto: string) => ({ width: texto.length * 8 })), strokeText: vi.fn(), fillText: vi.fn() };
    const simular = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as unknown as CanvasRenderingContext2D);
    const codificar = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    await transformarFigura('origem', { angulo: 90, espelharHorizontal: true, espelharVertical: false,
      corte: { x: 10, y: 10, largura: 70, altura: 70 }, textos: [{ id: 'a', conteudo: 'Amostra\n01', x: 50, y: 50, tamanho: 'medio', cor: 'preto' }] });
    expect(contexto.fillText.mock.calls.map(chamada => chamada[0])).toEqual(['Amostra', '01']);
    expect(contexto.fillText.mock.invocationCallOrder[0]).toBeGreaterThan(contexto.drawImage.mock.invocationCallOrder.at(-1)!);
    expect(contexto.strokeText).toHaveBeenCalledTimes(2);
    simular.mockRestore();
    codificar.mockRestore();
  });

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
