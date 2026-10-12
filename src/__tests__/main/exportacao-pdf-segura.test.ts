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
    fs.rmSync(pasta, { recursive: true, force: true });
    vi.clearAllMocks();
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
});
