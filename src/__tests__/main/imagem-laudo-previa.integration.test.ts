import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ambiente = vi.hoisted(() => ({ diretorio: '', falharPrevia: false }));

vi.mock('electron', () => {
  const criarImagem = (width: number, height: number) => ({
    isEmpty: () => false,
    getSize: () => ({ width, height }),
    resize: (opcoes: { width: number; height: number }) => criarImagem(opcoes.width, opcoes.height),
    toJPEG: () => Buffer.from(`jpeg:${width}x${height}`),
    toPNG: () => Buffer.from(`png:${width}x${height}`),
  });
  return {
    app: { getPath: () => ambiente.diretorio },
    nativeImage: {
      createFromBuffer: () => criarImagem(1600, 900),
      createFromPath: () => ambiente.falharPrevia ? { isEmpty: () => true } : criarImagem(1600, 900),
    },
  };
});

let sqlite: typeof import('../../main/database/sqlite');
let imagens: typeof import('../../main/services/imagem-laudo.service');

beforeEach(async () => {
  ambiente.diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-previa-'));
  ambiente.falharPrevia = false;
  vi.resetModules();
  sqlite = await import('../../main/database/sqlite');
  imagens = await import('../../main/services/imagem-laudo.service');
  await sqlite.executeNonQuery('CREATE TABLE configuracoes (chave TEXT PRIMARY KEY, valor TEXT, tipo TEXT)');
  await sqlite.executeNonQuery("INSERT INTO configuracoes VALUES ('perfil_previa_editor', 'equilibrado', 'string')");
  await sqlite.executeNonQuery(`CREATE TABLE imagens_laudo (
    id TEXT PRIMARY KEY, laudo_id TEXT, nome_arquivo TEXT, caminho_relativo TEXT,
    mime_type TEXT, tamanho INTEGER, sha256 TEXT, legenda TEXT, origem TEXT,
    sequencia INTEGER, disponivel_painel INTEGER NOT NULL DEFAULT 1,
    imagem_origem_id TEXT, ajustes_json TEXT, temporaria_sessao INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

afterEach(async () => {
  await sqlite?.closeDatabase();
  await rm(ambiente.diretorio, { recursive: true, force: true });
});

function estagiar(id: string, mimeType: string) {
  return imagens.estagiarImagemLaudoPorBytes('laudo', {
    id, nomeArquivo: `${id}.jpg`, mimeType, bytes: Buffer.from(`original-${id}`),
    legenda: '', origem: 'local', sequencia: 1,
  });
}

describe('prévia do editor e arquivo original', () => {
  it('limita a prévia ao espaço de exibição e conserva os bytes originais', async () => {
    estagiar('foto', 'image/jpeg');
    expect(imagens.listarImagensEstagiadasLaudo('laudo')).toMatchObject([{ id: 'foto', nomeArquivo: 'foto.jpg' }]);
    const preparada = await imagens.prepararImagemEditorLaudo('laudo', 'foto', 400, 300, 2);
    expect(imagens.listarImagensEstagiadasLaudo('laudo')).toEqual([]);
    expect(preparada.maiorLado).toBe(800);
    expect(Buffer.from(preparada.previaDataUri.split(',')[1], 'base64').toString()).toBe('jpeg:800x450');
    const [registro] = await sqlite.executeQuery<{ caminho_relativo: string; temporaria_sessao: number }>(
      'SELECT caminho_relativo, temporaria_sessao FROM imagens_laudo WHERE id = ?', ['foto']);
    expect(registro.temporaria_sessao).toBe(1);
    expect(await readFile(path.join(ambiente.diretorio, registro.caminho_relativo), 'utf8')).toBe('original-foto');
  });

  it('mantém a seleção temporária quando a prévia falha e remove o arquivo recém-persistido', async () => {
    estagiar('falha', 'image/png');
    ambiente.falharPrevia = true;
    await expect(imagens.prepararImagemEditorLaudo('laudo', 'falha', 400, 300, 1)).rejects.toThrow();
    expect(await sqlite.executeQuery('SELECT id FROM imagens_laudo WHERE id = ?', ['falha'])).toEqual([]);
    expect(imagens.obterImagemEstagiadaLaudo('laudo', 'falha').dataUri).toMatch(/^data:image\/png;base64,/);
  });
});
