import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ambiente = vi.hoisted(() => ({ diretorio: '', falharPrevia: false, largura: 1600, altura: 900 }));

vi.mock('electron', () => {
  const criarImagem = (width: number, height: number) => ({
    isEmpty: () => false,
    getSize: () => ({ width, height }),
    resize: (opcoes: { width: number; height: number }) => criarImagem(opcoes.width, opcoes.height),
    toJPEG: () => Buffer.from(`jpeg:${width}x${height}`),
    toPNG: () => Buffer.from(`png:${width}x${height}`),
    toBitmap: () => Buffer.from([0, 0, 0, 255]),
  });
  return {
    app: { getPath: () => ambiente.diretorio },
    nativeImage: {
      createFromBuffer: () => criarImagem(ambiente.largura, ambiente.altura),
      createFromPath: () => ambiente.falharPrevia ? { isEmpty: () => true } : criarImagem(ambiente.largura, ambiente.altura),
    },
  };
});

let sqlite: typeof import('../../main/database/sqlite');
let imagens: typeof import('../../main/services/imagem-laudo.service');

beforeAll(async () => {
  ambiente.diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-previa-'));
  ambiente.falharPrevia = false;
  ambiente.largura = 1600;
  ambiente.altura = 900;
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
  await sqlite.executeNonQuery('CREATE TABLE laudos (id TEXT PRIMARY KEY, conteudo TEXT)');
});

beforeEach(async () => {
  ambiente.falharPrevia = false;
  ambiente.largura = 1600;
  ambiente.altura = 900;
  imagens.descartarImagensEstagiadasLaudo('laudo');
  await sqlite.executeNonQuery('DELETE FROM imagens_laudo');
  await sqlite.executeNonQuery('DELETE FROM laudos');
  await sqlite.executeNonQuery('DELETE FROM configuracoes');
  await sqlite.executeNonQuery("INSERT INTO configuracoes VALUES ('perfil_previa_editor', 'equilibrado', 'string')");
});

afterAll(async () => {
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
  it('limita a cópia do PDF e conserva apenas a figura tratada após a conclusão', async () => {
    await sqlite.executeNonQuery('INSERT INTO configuracoes VALUES (?, ?, ?)', ['perfil_figura_laudo', 'maxima_economia', 'string']);
    const original = Buffer.alloc(50_000, 1);
    imagens.estagiarImagemLaudoPorBytes('laudo', { id: 'foto-usada', nomeArquivo: 'foto.jpg', mimeType: 'image/jpeg',
      bytes: original, legenda: '', origem: 'local', sequencia: 1 });
    imagens.estagiarImagemLaudoPorBytes('laudo', { id: 'foto-descartada', nomeArquivo: 'outra.jpg', mimeType: 'image/jpeg',
      bytes: Buffer.alloc(50_000, 2), legenda: '', origem: 'local', sequencia: 2 });
    await imagens.prepararImagemEditorLaudo('laudo', 'foto-usada', 400, 300, 1);
    await imagens.prepararImagemEditorLaudo('laudo', 'foto-descartada', 400, 300, 1);
    await sqlite.executeNonQuery('INSERT INTO laudos VALUES (?, ?)', ['laudo', '<figure data-image-id="foto-usada" data-image-original-id="foto-descartada"><img></figure>']);

    const impressao = await imagens.obterImagemImpressaoLaudo('laudo', 'foto-usada', 3000);
    expect(Buffer.from(impressao.dataUri.split(',')[1], 'base64').toString()).toBe('jpeg:1024x576');
    const antigos = await imagens.concluirImagensLaudo('laudo');
    await imagens.descartarArquivosConcluidos('laudo', antigos);

    const registros = await sqlite.executeQuery<{ id: string; tamanho: number; imagem_origem_id: string | null }>('SELECT id, tamanho, imagem_origem_id FROM imagens_laudo');
    expect(registros).toEqual([{ id: 'foto-usada', tamanho: 13, imagem_origem_id: null }]);
    expect((await sqlite.executeQuery<{ conteudo: string }>('SELECT conteudo FROM laudos'))[0].conteudo).not.toContain('data-image-original-id');
    expect((await imagens.obterImagemLaudoPorId('laudo', 'foto-usada')).dataUri).toBe(impressao.dataUri);
  });
  it.each([
    ['ausente', null, 400, 2, 640, 'jpeg:640x360'],
    ['inválido', 'desconhecido', 400, 2, 640, 'jpeg:640x360'],
    ['econômico no limite mínimo', 'economico', 100, 1, 480, 'jpeg:480x270'],
    ['econômico no limite máximo', 'economico', 2000, 4, 640, 'jpeg:640x360'],
    ['equilibrado salvo', 'equilibrado', 400, 2, 800, 'jpeg:800x450'],
    ['nítido salvo', 'nitido', 2000, 4, 1280, 'jpeg:1280x720'],
  ] as const)('prepara a prévia com perfil %s preservando o arquivo e a configuração', async (_cenario, perfil, larguraCss, densidade, maiorLado, previaEsperada) => {
    await sqlite.executeNonQuery('DELETE FROM configuracoes');
    if (perfil !== null) {
      await sqlite.executeNonQuery('INSERT INTO configuracoes VALUES (?, ?, ?)', ['perfil_previa_editor', perfil, 'string']);
    }
    estagiar('foto-perfil', 'image/jpeg');

    const preparada = await imagens.prepararImagemEditorLaudo('laudo', 'foto-perfil', larguraCss, larguraCss * 0.75, densidade);

    expect(preparada.maiorLado).toBe(maiorLado);
    expect(Buffer.from(preparada.previaDataUri.split(',')[1], 'base64').toString()).toBe(previaEsperada);
    const [registro] = await sqlite.executeQuery<{ caminho_relativo: string }>('SELECT caminho_relativo FROM imagens_laudo WHERE id = ?', ['foto-perfil']);
    expect(await readFile(path.join(ambiente.diretorio, registro.caminho_relativo), 'utf8')).toBe('original-foto-perfil');
    expect(await sqlite.executeQuery<{ valor: string }>('SELECT valor FROM configuracoes WHERE chave = ?', ['perfil_previa_editor']))
      .toEqual(perfil === null ? [] : [{ valor: perfil }]);
  });

  it('não amplia imagem menor que o limite mínimo do perfil econômico', async () => {
    await sqlite.executeNonQuery('DELETE FROM configuracoes');
    ambiente.largura = 320;
    ambiente.altura = 180;
    estagiar('foto-pequena', 'image/jpeg');

    const preparada = await imagens.prepararImagemEditorLaudo('laudo', 'foto-pequena', 1000, 750, 2);

    expect(Buffer.from(preparada.previaDataUri.split(',')[1], 'base64').toString()).toBe('jpeg:320x180');
    const original = await imagens.obterImagemLaudoPorId('laudo', 'foto-pequena');
    expect(Buffer.from(original.dataUri.split(',')[1], 'base64').toString()).toBe('original-foto-pequena');
  });

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
