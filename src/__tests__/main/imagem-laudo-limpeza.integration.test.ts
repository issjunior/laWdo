import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let diretorio: string;
let sqlite: typeof import('../../main/database/sqlite');
let imagens: typeof import('../../main/services/imagem-laudo.service');

beforeEach(async () => {
  diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-limpeza-imagens-'));
  vi.mocked(app.getPath).mockReturnValue(diretorio);
  vi.resetModules();
  sqlite = await import('../../main/database/sqlite');
  imagens = await import('../../main/services/imagem-laudo.service');
  await sqlite.executeNonQuery('CREATE TABLE laudos (id TEXT PRIMARY KEY, conteudo TEXT NOT NULL)');
  await sqlite.executeNonQuery("INSERT INTO laudos VALUES ('laudo', '<figure data-image-id=\"recorte\"></figure>')");
  await sqlite.executeNonQuery(`CREATE TABLE imagens_laudo (
    id TEXT PRIMARY KEY, laudo_id TEXT, caminho_relativo TEXT,
    imagem_origem_id TEXT, temporaria_sessao INTEGER
  )`);
});

afterEach(async () => {
  await sqlite?.closeDatabase();
  await rm(diretorio, { recursive: true, force: true });
  vi.mocked(app.getPath).mockReset();
});

async function adicionar(id: string, temporaria: number, origem: string | null = null, nomeArquivo = `${id}.png`) {
  const relativo = `imagens/laudos/laudo/${nomeArquivo}`;
  const absoluto = path.join(diretorio, relativo);
  await mkdir(path.dirname(absoluto), { recursive: true });
  await writeFile(absoluto, id);
  await sqlite.executeNonQuery('INSERT INTO imagens_laudo VALUES (?, ?, ?, ?, ?)', [id, 'laudo', relativo, origem, temporaria]);
  return absoluto;
}

describe('limpeza das imagens da sessão', () => {
  it('preserva figura salva e seu original, remove figura retirada e conserva imagem legada', async () => {
    const original = await adicionar('original', 1);
    const recorte = await adicionar('recorte', 1, 'original');
    const retirada = await adicionar('retirada', 1);
    const legada = await adicionar('legada', 0);

    expect(await imagens.limparImagensTemporariasSemReferencia('laudo')).toBe(1);
    expect(await sqlite.executeQuery<{ id: string }>('SELECT id FROM imagens_laudo ORDER BY id')).toEqual([
      { id: 'legada' }, { id: 'original' }, { id: 'recorte' },
    ]);
    await expect(readFile(original)).resolves.toBeTruthy();
    await expect(readFile(recorte)).resolves.toBeTruthy();
    await expect(readFile(legada)).resolves.toBeTruthy();
    await expect(readFile(retirada)).rejects.toThrow();
  });

  it('não apaga arquivo físico compartilhado por outra imagem', async () => {
    const compartilhado = await adicionar('retirada', 1, null, 'compartilhado.png');
    await adicionar('legada', 0, null, 'compartilhado.png');
    expect(await imagens.limparImagensTemporariasSemReferencia('laudo')).toBe(1);
    await expect(readFile(compartilhado)).resolves.toBeTruthy();
  });
});
