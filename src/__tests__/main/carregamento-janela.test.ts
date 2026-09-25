import { afterEach, describe, expect, it, vi } from 'vitest';
import { carregarConteudoJanela } from '../../main/utils/carregamento-janela';

afterEach(() => vi.useRealTimers());

describe('carregamento da janela', () => {
  it('conclui quando o conteúdo é carregado', async () => {
    await expect(carregarConteudoJanela(() => Promise.resolve())).resolves.toBeUndefined();
  });

  it('propaga a falha de carregamento', async () => {
    await expect(carregarConteudoJanela(() => Promise.reject(new Error('Arquivo ausente'))))
      .rejects.toThrow('Arquivo ausente');
  });

  it('encerra a espera quando o carregamento não responde', async () => {
    vi.useFakeTimers();
    const resultado = expect(carregarConteudoJanela(() => new Promise<void>(() => undefined), 50))
      .rejects.toThrow('TEMPO_LIMITE_CARREGAMENTO_JANELA');

    await vi.advanceTimersByTimeAsync(50);
    await resultado;
  });
});
