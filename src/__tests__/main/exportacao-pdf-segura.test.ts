import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gerarPdfPreparado: vi.fn(),
  showSaveDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  dialog: { showSaveDialog: mocks.showSaveDialog },
}));
vi.mock('../../main/services/pdf-prontidao.service.js', () => ({
  gerarPdfPreparado: mocks.gerarPdfPreparado,
  ErroGeracaoPdf: class extends Error {
    constructor(readonly falhaPdf: unknown) { super('FALHA_PDF'); }
  },
}));
vi.mock('../../main/services/laudo.service.js', () => ({
  laudoService: { findById: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../main/utils/logger.js', () => ({
  getLogger: () => ({ debug: vi.fn(), error: vi.fn() }),
}));

import { exportarLaudo } from '../../main/services/exportacao.service';

describe('exportação de PDF', () => {
  let pasta: string;
  let destino: string;

  beforeEach(() => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'lawdo-exportacao-teste-'));
    destino = path.join(pasta, 'laudo.pdf');
    fs.writeFileSync(destino, 'arquivo anterior');
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: destino });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(pasta, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it.each(['EPERM', 'EACCES', 'EBUSY'])('preserva o arquivo e orienta o usuário quando o destino está bloqueado: %s', codigo => {
    mocks.gerarPdfPreparado.mockResolvedValue(Buffer.from('novo PDF'));
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw Object.assign(new Error('Destino indisponível'), { code: codigo }); });
    return exportarLaudo({ laudoId: 'teste', formato: 'pdf', html: '<p>laudo</p>' }).then(resultado => {
      expect(resultado.success).toBe(false);
      expect(resultado.error).toContain('foi gerado');
      expect(resultado.error).toContain('Feche o arquivo');
      expect(resultado.error).toContain('outro nome');
      expect(resultado.falhaPdf).toBeUndefined();
      expect(fs.readFileSync(destino, 'utf-8')).toBe('arquivo anterior');
      expect(fs.readdirSync(pasta)).toEqual(['laudo.pdf']);
    });
  });

  it('preserva o arquivo existente quando a preparação falha', async () => {
    mocks.gerarPdfPreparado.mockRejectedValue(new Error('falha na impressão'));
    const resultado = await exportarLaudo({ laudoId: 'teste', formato: 'pdf', html: '<p>laudo</p>' });
    expect(resultado.success).toBe(false);
    expect(fs.readFileSync(destino, 'utf-8')).toBe('arquivo anterior');
    expect(fs.readdirSync(pasta)).toEqual(['laudo.pdf']);
  });

  it('substitui o arquivo somente após receber um PDF completo', async () => {
    mocks.gerarPdfPreparado.mockResolvedValue(Buffer.from('novo PDF'));
    const resultado = await exportarLaudo({ laudoId: 'teste', formato: 'pdf', html: '<p>laudo</p>' });
    expect(resultado.success).toBe(true);
    expect(fs.readFileSync(destino, 'utf-8')).toBe('novo PDF');
    expect(fs.readdirSync(pasta)).toEqual(['laudo.pdf']);
  });

  it('encaminha A4 e o cabeçalho posicionado nas margens personalizadas para a preparação', async () => {
    mocks.gerarPdfPreparado.mockResolvedValue(Buffer.from('novo PDF'));
    await exportarLaudo({ laudoId: 'teste', formato: 'pdf', html: '<p>laudo</p>',
      margens: { top: 4, right: 2, bottom: 2.5, left: 3 }, cabecalhoPaginasHtml: '<p>LAUDO Nº TESTE</p>' });
    expect(mocks.gerarPdfPreparado).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      pageSize: 'A4', landscape: false, headerTemplate: expect.stringContaining('top: 4cm; left: 3cm;'),
    }), '<p>LAUDO Nº TESTE</p>');
  });
});
