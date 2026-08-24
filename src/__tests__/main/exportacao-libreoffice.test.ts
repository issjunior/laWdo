import { beforeEach, describe, expect, it, vi } from 'vitest';

const estatisticasArquivo = { isFile: () => true };
const estatisticasDiretorio = { isFile: () => false };
const statMock = vi.fn();

vi.mock('fs', async (importarOriginal) => {
  const fsOriginal = await importarOriginal<typeof import('fs')>();
  const promises = { ...fsOriginal.promises, stat: statMock };
  return {
    ...fsOriginal,
    promises,
    default: { ...fsOriginal, promises },
  };
});

describe('verificarLibreOffice', () => {
  beforeEach(() => {
    vi.resetModules();
    statMock.mockReset();
    statMock.mockResolvedValue(estatisticasArquivo);
  });

  it('verifica a instalação sem iniciar o LibreOffice e reutiliza o resultado em cache', async () => {
    const { verificarLibreOffice } = await import('../../main/services/exportacao.service.js');

    await expect(verificarLibreOffice()).resolves.toBe(true);
    await expect(verificarLibreOffice()).resolves.toBe(true);

    expect(statMock).toHaveBeenCalledOnce();
  });

  it('retorna falso quando o executável não é encontrado', async () => {
    statMock.mockRejectedValue(new Error('Arquivo inexistente'));
    const { verificarLibreOffice } = await import('../../main/services/exportacao.service.js');

    await expect(verificarLibreOffice()).resolves.toBe(false);
  });

  it('compartilha uma única verificação entre chamadas simultâneas', async () => {
    let concluir: ((valor: typeof estatisticasArquivo) => void) | undefined;
    statMock.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
    const { verificarLibreOffice } = await import('../../main/services/exportacao.service.js');

    const primeira = verificarLibreOffice();
    await vi.waitFor(() => expect(statMock).toHaveBeenCalledOnce());
    const segunda = verificarLibreOffice();
    concluir?.(estatisticasArquivo);

    await expect(Promise.all([primeira, segunda])).resolves.toEqual([true, true]);
    expect(statMock).toHaveBeenCalledOnce();
  });

  it('ignora candidatos que não representam arquivos', async () => {
    statMock.mockResolvedValue(estatisticasDiretorio);
    const { verificarLibreOffice } = await import('../../main/services/exportacao.service.js');

    await expect(verificarLibreOffice()).resolves.toBe(false);
  });
});
