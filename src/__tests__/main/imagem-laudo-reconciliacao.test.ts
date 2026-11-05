import path from 'node:path';
import { app } from 'electron';
import { describe, expect, it, vi } from 'vitest';

const simulacao = vi.hoisted(() => ({
  transacaoAtiva: false,
  access: vi.fn(),
  executeQuery: vi.fn(),
  executeNonQuery: vi.fn(),
}));

vi.mock('node:fs/promises', async importarOriginal => {
  const original = await importarOriginal<typeof import('node:fs/promises')>();
  const simulado = { ...original, access: simulacao.access };
  return { ...simulado, default: simulado };
});
vi.mock('@main/database/sqlite.js', () => ({
  executeQuery: simulacao.executeQuery,
  executeNonQuery: simulacao.executeNonQuery,
  withTransaction: async (acao: () => Promise<void>) => {
    simulacao.transacaoAtiva = true;
    try { await acao(); } finally { simulacao.transacaoAtiva = false; }
  },
}));
vi.mock('@main/services/processador-imagens.service.js', () => ({ processarImagem: vi.fn() }));

describe('reconciliação de imagens', () => {
  it('atualiza vínculos em transação e verifica arquivos assincronamente depois de liberá-la', async () => {
    const { reconciliarImagensLaudo } = await import('@main/services/imagem-laudo.service.js');
    const caminho = path.join('imagens', 'laudos', 'laudo', 'imagem.png');
    simulacao.executeQuery.mockResolvedValue([
      { id: 'inserida', caminho_relativo: caminho, disponivel_painel: 1 },
      { id: 'painel', caminho_relativo: caminho, disponivel_painel: 0 },
    ]);
    simulacao.executeNonQuery.mockImplementation(async () => {
      expect(simulacao.transacaoAtiva).toBe(true);
    });
    const transacoesDuranteAcesso: boolean[] = [];
    simulacao.access.mockImplementationOnce(async () => {
      transacoesDuranteAcesso.push(simulacao.transacaoAtiva);
    }).mockImplementationOnce(async () => {
      transacoesDuranteAcesso.push(simulacao.transacaoAtiva);
      throw Object.assign(new Error('Arquivo ausente'), { code: 'ENOENT' });
    });
    const resultado = await reconciliarImagensLaudo('laudo', '<figure data-image-id="inserida"></figure>');
    expect(simulacao.access).toHaveBeenCalledTimes(2);
    expect(resultado).toEqual({
      recuperadasParaPainel: 1, arquivadasComoInseridas: 1, arquivosAusentes: 1, referenciasSemImagem: 0,
    });
    expect(simulacao.executeNonQuery).toHaveBeenCalledTimes(2);
    expect(simulacao.access).toHaveBeenCalledTimes(2);
    expect(transacoesDuranteAcesso).toEqual([false, false]);
    expect(simulacao.access).toHaveBeenCalledWith(path.join(app.getPath('userData'), caminho));
  });
});
