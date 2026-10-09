import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { app } from 'electron';
import { describe, expect, it, vi } from 'vitest';

function consultarSnapshot<T>(caminho: string, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const banco = new sqlite3.Database(caminho);
    banco.all<T>(sql, (erro, linhas) => {
      banco.close(() => erro ? reject(erro) : resolve(linhas));
    });
  });
}

describe('migration v39 dos projéteis personalizados', () => {
  for (const versao of [37, 38]) {
    it(`zera apenas os cadastros antigos ao atualizar banco v${versao}`, async () => {
      const diretorio = await fs.mkdtemp(path.join(os.tmpdir(), `lawdo-projeteis-v${versao}-`));
      vi.mocked(app.getPath).mockReturnValue(diretorio);
      vi.resetModules();
      let banco = await import('@main/database/index');
      let sqlite = await import('@main/database/sqlite');

      try {
        await banco.setupDatabase();
        await sqlite.executeNonQuery('DROP TABLE projeteis_personalizados');
        await sqlite.executeNonQuery(`CREATE TABLE projeteis_personalizados (
          id TEXT PRIMARY KEY, calibre TEXT NOT NULL, tipo TEXT NOT NULL, massa_gramas REAL NOT NULL,
          diametro_min_mm REAL, diametro_max_mm REAL, comprimento_min_mm REAL, comprimento_max_mm REAL,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          ${versao === 38 ? ', calibre_real_mm REAL, altura_maxima_mm REAL' : ''}
        )`);
        await sqlite.executeNonQuery(`INSERT INTO projeteis_personalizados (
          id, calibre, tipo, massa_gramas, diametro_min_mm, diametro_max_mm,
          comprimento_min_mm, comprimento_max_mm, created_at, updated_at
        ) VALUES ('antigo', '9 mm', 'ETOG', 8, 9, 9, 15, 15, '2026-01-01', '2026-01-01')`);
        await sqlite.executeNonQuery('DELETE FROM schema_version');
        await sqlite.executeNonQuery('INSERT INTO schema_version (version) VALUES (?)', [versao]);
        await sqlite.closeDatabase();

        vi.resetModules();
        banco = await import('@main/database/index');
        sqlite = await import('@main/database/sqlite');
        await banco.setupDatabase();

        const colunas = await sqlite.executeQuery<{ name: string }>('PRAGMA table_info(projeteis_personalizados)');
        expect(colunas.map(coluna => coluna.name)).toEqual([
          'id', 'calibre', 'tipo', 'massa_gramas', 'calibre_real_mm', 'altura_maxima_mm', 'created_at', 'updated_at',
        ]);
        expect(await sqlite.executeQuery<{ total: number }>('SELECT COUNT(*) AS total FROM projeteis_personalizados')).toEqual([{ total: 0 }]);
        expect(await banco.getSchemaVersion()).toBe(39);

        const diretorioSnapshots = path.join(diretorio, 'backups-migracoes');
        const snapshots = await fs.readdir(diretorioSnapshots);
        expect(snapshots).toHaveLength(1);
        const registrosSnapshot = await consultarSnapshot<{ id: string }>(path.join(diretorioSnapshots, snapshots[0]), 'SELECT id FROM projeteis_personalizados');
        expect(registrosSnapshot).toEqual([{ id: 'antigo' }]);

        await sqlite.executeNonQuery(`INSERT INTO projeteis_personalizados
          (id, calibre, tipo, massa_gramas, calibre_real_mm, altura_maxima_mm, created_at, updated_at)
          VALUES ('novo', '9 mm', 'ETOG', 8, 9, 15, '2026-02-01', '2026-02-01')`);
        await sqlite.closeDatabase();

        vi.resetModules();
        banco = await import('@main/database/index');
        sqlite = await import('@main/database/sqlite');
        await banco.setupDatabase();
        expect(await sqlite.executeQuery<{ id: string }>('SELECT id FROM projeteis_personalizados')).toEqual([{ id: 'novo' }]);
        expect(await fs.readdir(diretorioSnapshots)).toHaveLength(1);
      } finally {
        await sqlite.closeDatabase();
        await fs.rm(diretorio, { recursive: true, force: true });
      }
    });
  }
});
