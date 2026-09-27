import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('instância única', () => {
  beforeEach(() => vi.resetModules());

  it('encerra a segunda instância antes de carregar o aplicativo', async () => {
    const { iniciarInstanciaUnica } = await import('../../main/utils/instancia-unica');
    const aplicativo = {
      requestSingleInstanceLock: vi.fn(() => false),
      on: vi.fn(),
      exit: vi.fn(),
    };

    expect(iniciarInstanciaUnica(aplicativo)).toBe(false);
    expect(aplicativo.exit).toHaveBeenCalledWith(0);
    expect(aplicativo.on).not.toHaveBeenCalled();
  });

  it('entrega uma ativação recebida enquanto a janela ainda não existe', async () => {
    const { iniciarInstanciaUnica, definirAtivadorInstancia } = await import('../../main/utils/instancia-unica');
    let segundaInstancia: (() => void) | undefined;
    const aplicativo = {
      requestSingleInstanceLock: vi.fn(() => true),
      on: vi.fn((_evento: string, acao: () => void) => { segundaInstancia = acao; }),
      exit: vi.fn(),
    };
    const ativar = vi.fn();

    expect(iniciarInstanciaUnica(aplicativo)).toBe(true);
    segundaInstancia?.();
    definirAtivadorInstancia(ativar);
    segundaInstancia?.();

    expect(ativar).toHaveBeenCalledTimes(2);
    expect(aplicativo.exit).not.toHaveBeenCalled();
  });
});
