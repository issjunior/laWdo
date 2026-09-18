import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MARGINS, getMargens } from '../../renderer/lib/margens';

const configuracaoOriginal = window.ipcAPI.configuracao;

describe('getMargens', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(window.ipcAPI, { configuracao: configuracaoOriginal });
  });

  it('usa as margens padrão quando a configuração ainda não existe', async () => {
    const obter = vi.fn().mockResolvedValue({ success: true });
    Object.assign(window.ipcAPI, { configuracao: { ...configuracaoOriginal, obter } });

    await expect(getMargens()).resolves.toEqual(DEFAULT_MARGINS);
  });

  it('usa as margens padrão quando a configuração está inválida', async () => {
    const obter = vi.fn().mockResolvedValue({ success: true, data: '{inválido' });
    Object.assign(window.ipcAPI, { configuracao: { ...configuracaoOriginal, obter } });

    await expect(getMargens()).resolves.toEqual(DEFAULT_MARGINS);
  });
});
