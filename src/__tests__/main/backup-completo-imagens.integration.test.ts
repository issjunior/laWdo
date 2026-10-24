import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let diretorio: string;
let sqlite: typeof import('../../main/database/sqlite');
let backup: typeof import('../../main/services/backup.service');
let arquivo: typeof import('../../main/services/backup-arquivo.service');
let bancoBackup: typeof import('../../main/services/backup-sqlite.service');

beforeEach(async () => {
  diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-backup-imagens-'));
  vi.mocked(app.getPath).mockReturnValue(diretorio);
  vi.resetModules();
  sqlite = await import('../../main/database/sqlite');
  backup = await import('../../main/services/backup.service');
  arquivo = await import('../../main/services/backup-arquivo.service');
  bancoBackup = await import('../../main/services/backup-sqlite.service');
  const { CURRENT_SCHEMA_VERSION } = await import('../../main/database/index');
  await sqlite.executeNonQuery('CREATE TABLE schema_version (version INTEGER)');
  await sqlite.executeNonQuery('INSERT INTO schema_version VALUES (?)', [CURRENT_SCHEMA_VERSION]);
  await sqlite.executeNonQuery('CREATE TABLE users (id TEXT PRIMARY KEY, foto_url TEXT, username TEXT, email TEXT, senha_hash TEXT)');
  await sqlite.executeNonQuery("INSERT INTO users VALUES ('perito', NULL, 'perito-local', 'local@teste.invalid', 'hash-local')");
  await sqlite.executeNonQuery('CREATE TABLE reps (id TEXT PRIMARY KEY)');
  await sqlite.executeNonQuery("INSERT INTO reps VALUES ('rep')");
  await sqlite.executeNonQuery('CREATE TABLE laudos (id TEXT PRIMARY KEY, conteudo TEXT NOT NULL)');
  await sqlite.executeNonQuery("INSERT INTO laudos VALUES ('laudo', '<p>Laudo</p>'), ('outro', '<p>Outro laudo</p>')");
  await sqlite.executeNonQuery('CREATE TABLE configuracoes (chave TEXT PRIMARY KEY, valor TEXT)');
  await sqlite.executeNonQuery(`CREATE TABLE imagens_laudo (
    id TEXT PRIMARY KEY, laudo_id TEXT REFERENCES laudos(id), caminho_relativo TEXT,
    imagem_origem_id TEXT, disponivel_painel INTEGER, ajustes_json TEXT)`);
});

afterEach(async () => {
  await sqlite?.closeDatabase();
  await rm(diretorio, { recursive: true, force: true });
  vi.mocked(app.getPath).mockReset();
});

async function adicionarImagem(id: string, opcoes: { laudo?: string; origem?: string; caminho?: string; painel?: number } = {}): Promise<string> {
  const caminho = opcoes.caminho ?? `imagens/laudos/${id}.png`;
  await mkdir(path.dirname(path.join(diretorio, caminho)), { recursive: true });
  await writeFile(path.join(diretorio, caminho), `foto-${caminho}`);
  await sqlite.executeNonQuery('INSERT INTO imagens_laudo VALUES (?, ?, ?, ?, ?, ?)',
    [id, opcoes.laudo ?? 'laudo', caminho, opcoes.origem ?? null, opcoes.painel ?? 1, opcoes.origem ? '{"angulo":90}' : null]);
  return caminho;
}

async function salvarHtml(html: string, laudo = 'laudo'): Promise<void> {
  await sqlite.executeNonQuery('UPDATE laudos SET conteudo = ? WHERE id = ?', [html, laudo]);
}

async function criarEExtrair() {
  const destino = path.join(diretorio, 'novo.lawdo-backup');
  expect(await backup.criarBackup(destino, 'senha-teste')).toEqual({ success: true, path: destino });
  const extraido = path.join(diretorio, 'extraido');
  const manifesto = await arquivo.extrairArquivoBackup(destino, 'senha-teste', extraido);
  return { extraido, manifesto };
}

async function consultarImagens(extraido: string) {
  const conexao = await bancoBackup.abrirBancoBackup(path.join(extraido, 'laudopericial.db'), true);
  try {
    return await bancoBackup.consultarBackup<{ id: string; imagem_origem_id: string | null; ajustes_json: string | null }>(conexao,
      'SELECT id, imagem_origem_id, ajustes_json FROM imagens_laudo ORDER BY id');
  } finally {
    await bancoBackup.encerrarBancoBackup(conexao);
  }
}

describe('seleção das imagens do backup completo', () => {
  it('preserva apenas figuras salvas, suas cadeias de originais e imagens de outros laudos, sem repetir arquivos', async () => {
    await adicionarImagem('base');
    await adicionarImagem('recorte', { origem: 'base' });
    await adicionarImagem('inserida', { origem: 'recorte', painel: 1 });
    await adicionarImagem('segunda', { origem: 'base', caminho: 'imagens/laudos/inserida.png' });
    await adicionarImagem('outra', { laudo: 'outro' });
    const naoUsada = await adicionarImagem('nao-usada');
    await adicionarImagem('removida', { painel: 0 });
    await salvarHtml(`<figure data-image-id="inserida"><img src="data:image/png;base64,AAAA"></figure>
      <img data-image-id='segunda'><img DATA-IMAGE-ID=inserida>
      <figure data-dummy="true" data-image-id="dummy"><img data-image-id="dummy-filho"></figure>
      <!-- <img data-image-id="comentario"> --><p>&lt;img data-image-id="texto"&gt;</p>`);
    await salvarHtml('<img data-image-id="outra">', 'outro');
    const antes = await sqlite.executeQuery('SELECT * FROM imagens_laudo ORDER BY id');
    const { extraido, manifesto } = await criarEExtrair();
    const imagens = await consultarImagens(extraido);
    expect(imagens.map(imagem => imagem.id)).toEqual(['base', 'inserida', 'outra', 'recorte', 'segunda']);
    expect(imagens.find(imagem => imagem.id === 'inserida')).toMatchObject({ imagem_origem_id: 'recorte', ajustes_json: '{"angulo":90}' });
    expect(manifesto.arquivos.filter(item => item.nome.startsWith('imagens/')).map(item => item.nome).sort()).toEqual([
      'imagens/laudos/base.png', 'imagens/laudos/inserida.png', 'imagens/laudos/outra.png', 'imagens/laudos/recorte.png',
    ]);
    expect(await backup.previaBackupCompleto(extraido, manifesto)).toMatchObject({ imagens: 4, laudos: 2 });
    expect(await sqlite.executeQuery('SELECT * FROM imagens_laudo ORDER BY id')).toEqual(antes);
    expect(await readFile(path.join(diretorio, naoUsada), 'utf8')).toContain('foto-');

    await backup.restaurarBackupExtraido(extraido, manifesto);
    expect(await sqlite.executeQuery('SELECT id FROM imagens_laudo ORDER BY id')).toEqual(imagens.map(({ id }) => ({ id })));
    expect(await sqlite.executeQuery('SELECT username, senha_hash FROM users')).toEqual([{ username: 'perito-local', senha_hash: 'hash-local' }]);
    expect(await readFile(path.join(diretorio, 'imagens/laudos/base.png'), 'utf8')).toContain('foto-');
    await backup.concluirRestauracaoPendente();
  });

  it('não inclui fotos quando o conteúdo salvo não tem figuras reais', async () => {
    await adicionarImagem('sobrando');
    await salvarHtml('<figure data-dummy="true" data-image-id="dummy"></figure>');
    const { extraido, manifesto } = await criarEExtrair();
    expect(await consultarImagens(extraido)).toEqual([]);
    expect(await backup.previaBackupCompleto(extraido, manifesto)).toMatchObject({ imagens: 0 });
  });

  it.each(['ausente', 'outro-laudo', 'origem-ausente', 'origem-outro-laudo', 'ciclo', 'id-invalido', 'arquivo-ausente'])(
    'recusa %s sem alterar os dados ativos', async cenario => {
      await adicionarImagem('foto');
      await salvarHtml('<img data-image-id="foto">');
      if (cenario === 'ausente') await salvarHtml('<img data-image-id="inexistente">');
      if (cenario === 'outro-laudo') await salvarHtml('<img data-image-id="foto">', 'outro');
      if (cenario === 'origem-ausente') await sqlite.executeNonQuery("UPDATE imagens_laudo SET imagem_origem_id = 'inexistente'");
      if (cenario === 'origem-outro-laudo') {
        await adicionarImagem('base', { laudo: 'outro' });
        await sqlite.executeNonQuery("UPDATE imagens_laudo SET imagem_origem_id = 'base' WHERE id = 'foto'");
      }
      if (cenario === 'ciclo') await sqlite.executeNonQuery("UPDATE imagens_laudo SET imagem_origem_id = 'foto'");
      if (cenario === 'id-invalido') await salvarHtml('<img data-image-id="../foto">');
      if (cenario === 'arquivo-ausente') await rm(path.join(diretorio, 'imagens/laudos/foto.png'));
      const antes = await sqlite.executeQuery('SELECT * FROM imagens_laudo ORDER BY id');
      const resultado = await backup.criarBackup(path.join(diretorio, 'invalido.lawdo-backup'), 'senha-teste');
      expect(resultado.success).toBe(false);
      expect(resultado.error).toMatch(/imag(?:em|ens)/i);
      expect(await sqlite.executeQuery('SELECT * FROM imagens_laudo ORDER BY id')).toEqual(antes);
      expect(await readdir(diretorio)).not.toContain('invalido.lawdo-backup');
      expect((await readdir(diretorio)).some(nome => nome.startsWith('backup-temporario-'))).toBe(false);
    },
  );

  it('continua aceitando backups antigos que incluem imagens não utilizadas', async () => {
    const caminho = await adicionarImagem('painel');
    const copiaBanco = path.join(diretorio, 'antigo.db');
    await sqlite.criarBackupConsistente(copiaBanco);
    const destino = path.join(diretorio, 'antigo.lawdo-backup');
    const { CURRENT_SCHEMA_VERSION } = await import('../../main/database/index');
    await arquivo.criarArquivoBackup(destino, 'senha-teste', 'completo', '1.0.0', CURRENT_SCHEMA_VERSION, [
      { nome: 'laudopericial.db', caminho: copiaBanco },
      { nome: caminho, caminho: path.join(diretorio, caminho) },
      { nome: 'segredos.json', conteudo: Buffer.from('[]') },
    ]);
    const extraido = path.join(diretorio, 'antigo-extraido');
    const manifesto = await arquivo.extrairArquivoBackup(destino, 'senha-teste', extraido);
    expect(await backup.previaBackupCompleto(extraido, manifesto)).toMatchObject({ imagens: 1 });
  });
});
