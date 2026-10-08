import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const cabecalho = 'calibre;tipo;massa_gramas;diametro_min_mm;diametro_max_mm;comprimento_min_mm;comprimento_max_mm';

describe('importação de projéteis personalizados', () => {
  let diretorio = '';
  let fecharBanco: () => Promise<void>;
  let servico: typeof import('@main/services/projetil.service').projetilService;

  beforeAll(async () => {
    diretorio = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-projeteis-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    vi.resetModules();
    const database = await import('@main/database/index');
    const sqlite = await import('@main/database/sqlite');
    servico = (await import('@main/services/projetil.service')).projetilService;
    fecharBanco = sqlite.closeDatabase;
    await database.setupDatabase();
  });

  afterAll(async () => {
    await fecharBanco?.();
    if (diretorio) await fs.rm(diretorio, { recursive: true, force: true });
  });

  it('importa decimais brasileiros, ignora duplicatas e persiste os dados', async () => {
    const csv = `${cabecalho}\n9 mm;ETOG;8,03;9;9,02;15,3;15,4\n9 mm;ETOG;8,03;9;9,02;15,3;15,4`;
    expect(await servico.importarCsv(csv)).toBe(1);
    expect(await servico.importarCsv(csv)).toBe(0);
    expect(await servico.listar()).toEqual([expect.objectContaining({
      calibre: '9 mm', massaGramas: 8.03, diametroMaxMm: 9.02,
    })]);
  });

  it('recusa arquivo inválido sem gravar suas linhas anteriores', async () => {
    const csv = `${cabecalho}\n.32 Auto;ETOG;4,6;7,9;7,92;11,5;11,5\n.454 Casull;ETPP;16,85;11,45;11,42;17,8;17,8`;
    await expect(servico.importarCsv(csv)).rejects.toThrow('Linha 3');
    expect(await servico.listar()).toHaveLength(1);
  });
});
