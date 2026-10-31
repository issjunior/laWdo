import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { app } from 'electron';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

let diretorio: string;
let sqlite: typeof import('../../main/database/sqlite');

beforeAll(async () => {
  diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-config-regressao-'));
  vi.mocked(app.getPath).mockReturnValue(diretorio);
  sqlite = await import('../../main/database/sqlite');
  await (await import('../../main/database/index')).setupDatabase();
  await sqlite.executeNonQuery("INSERT INTO users (id, nome, email, username, senha_hash) VALUES ('perito', 'Perito', 'teste@local.invalid', 'perito', 'hash')");
});
afterAll(async () => { await sqlite?.closeDatabase(); if (diretorio) await rm(diretorio, { recursive: true, force: true }); });

it('exporta e restaura os três perfis de imagem sem importar configuração exclusiva da instalação', async () => {
  const configuracao = await import('../../main/services/config-backup.service');
  const arquivo = await import('../../main/services/backup-arquivo.service');
  const preferencias = [
    { chave: 'perfil_figura_laudo', valor: 'compacto', tipo: 'string' },
    { chave: 'perfil_previa_editor', valor: 'nitido', tipo: 'string' },
    { chave: 'qualidade_imagem_ia', valor: JSON.stringify({ versao: 1, qualidade: 'muito_economica' }), tipo: 'json' },
  ];
  for (const registro of preferencias) await sqlite.executeNonQuery('INSERT OR REPLACE INTO configuracoes (chave, valor, tipo) VALUES (?, ?, ?)', [registro.chave, registro.valor, registro.tipo]);
  await sqlite.executeNonQuery("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('atalho_desktop_linux', 'instalacao-local')");
  const destino = path.join(diretorio, 'preferencias.lawdo-backup');
  expect(await configuracao.exportarConfig(destino, 'senha-sintetica')).toEqual({ success: true, path: destino });
  const extraido = path.join(diretorio, 'extraido');
  const manifesto = await arquivo.extrairArquivoBackup(destino, 'senha-sintetica', extraido);
  const dados: unknown = JSON.parse(await readFile(path.join(extraido, 'configuracao.json'), 'utf8'));
  expect(dados).toEqual(expect.objectContaining({ configuracoes: expect.arrayContaining(preferencias.map(registro => expect.objectContaining(registro))) }));
  expect(JSON.stringify(dados)).not.toContain('instalacao-local');
  await sqlite.executeNonQuery("UPDATE configuracoes SET valor = 'alterado' WHERE chave IN ('perfil_figura_laudo', 'perfil_previa_editor', 'qualidade_imagem_ia')");
  await configuracao.restaurarConfig(extraido, manifesto);
  for (const registro of preferencias) expect(await sqlite.executeQuery('SELECT chave, valor, tipo FROM configuracoes WHERE chave = ?', [registro.chave])).toEqual([registro]);
  expect(await sqlite.executeQuery("SELECT valor FROM configuracoes WHERE chave = 'atalho_desktop_linux'")).toEqual([{ valor: 'instalacao-local' }]);
});
