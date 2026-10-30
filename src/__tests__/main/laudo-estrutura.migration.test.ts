import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let diretorio = '';
let sqlite: typeof import('../../main/database/sqlite.js');
let migrar: typeof import('../../main/database/laudo-estrutura.migration.js').migrarEstruturaIncorporadaLaudo;
beforeEach(async () => {
  diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-estrutura-migracao-'));
  vi.mocked(app.getPath).mockReturnValue(diretorio);
  vi.resetModules();
  sqlite = await import('../../main/database/sqlite.js');
  migrar = (await import('../../main/database/laudo-estrutura.migration.js')).migrarEstruturaIncorporadaLaudo;
  await sqlite.executeNonQuery('CREATE TABLE templates (id TEXT PRIMARY KEY)');
  await sqlite.executeNonQuery('CREATE TABLE laudos (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES templates(id), conteudo TEXT NOT NULL)');
  await sqlite.executeNonQuery('CREATE TABLE imagens_laudo (id TEXT PRIMARY KEY, laudo_id TEXT REFERENCES laudos(id) ON DELETE CASCADE)');
  await sqlite.executeNonQuery('CREATE INDEX idx_laudos_template ON laudos(template_id)');
  await sqlite.executeNonQuery("INSERT INTO templates VALUES ('template')");
  await sqlite.executeNonQuery("INSERT INTO laudos VALUES ('laudo', 'template', '<p>Texto original</p>')");
  await sqlite.executeNonQuery("INSERT INTO imagens_laudo VALUES ('imagem', 'laudo')");
});
afterEach(async () => {
  await sqlite?.closeDatabase();
  if (diretorio) await rm(diretorio, { recursive: true, force: true });
});

describe('migration da estrutura incorporada do laudo', () => {
  it('preserva conteúdo, referências e índices e permite dispensar o cadastro de template', async () => {
    await migrar();
    expect(await sqlite.executeQuery('SELECT * FROM laudos')).toEqual([
      { id: 'laudo', template_id: 'template', conteudo: '<p>Texto original</p>', estrutura_incorporada_json: null },
    ]);
    expect(await sqlite.executeQuery('SELECT * FROM imagens_laudo')).toEqual([{ id: 'imagem', laudo_id: 'laudo' }]);
    expect(await sqlite.executeQuery('PRAGMA foreign_key_check')).toEqual([]);
    expect(await sqlite.executeQuery<{ name: string }>('PRAGMA index_list(laudos)')).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'idx_laudos_template' })]));
    await sqlite.executeNonQuery("INSERT INTO laudos (id, conteudo, estrutura_incorporada_json) VALUES ('importado', 'Texto', '{}')");
    await expect(sqlite.executeNonQuery("INSERT INTO laudos (id, conteudo) VALUES ('invalido', 'Texto')")).rejects.toThrow();
  });

  it('mantém a aplicação repetida da migração idempotente', async () => {
    await migrar();
    await migrar();
    expect(await sqlite.executeQuery('SELECT id FROM laudos')).toEqual([{ id: 'laudo' }]);
    expect(await sqlite.executeQuery('PRAGMA foreign_key_check')).toEqual([]);
  });
  it('impede um segundo laudo e bloqueia bancos legados duplicados sem remover registros', async () => {
    const { garantirLaudoUnicoPorRep } = await import('../../main/database/laudo-estrutura.migration.js');
    await sqlite.executeNonQuery('ALTER TABLE laudos ADD COLUMN rep_id TEXT');
    await sqlite.executeNonQuery("UPDATE laudos SET rep_id = 'rep'");
    await garantirLaudoUnicoPorRep();
    await expect(sqlite.executeNonQuery("INSERT INTO laudos (id, template_id, conteudo, rep_id) VALUES ('segundo', 'template', 'Texto', 'rep')")).rejects.toThrow('UNIQUE');
    await sqlite.executeNonQuery('DROP INDEX idx_laudos_rep_unico');
    await sqlite.executeNonQuery("INSERT INTO laudos (id, template_id, conteudo, rep_id) VALUES ('legado', 'template', 'Texto legado', 'rep')");
    await expect(garantirLaudoUnicoPorRep()).rejects.toThrow('SCHEMA_INCOMPATIVEL');
    expect(await sqlite.executeQuery('SELECT id FROM laudos ORDER BY id')).toEqual([{ id: 'laudo' }, { id: 'legado' }]);
  });

});
