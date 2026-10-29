import fs from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ipcMain } from 'electron';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ambiente = vi.hoisted(() => ({ diretorio: '', largura: 4000, altura: 2000, transparente: false,
  invalida: false, vazia: false, maior: false, codificar: vi.fn(), redimensionar: vi.fn() }));

vi.mock('electron', () => {
  const criarImagem = (width: number, height: number) => ({
    isEmpty: () => ambiente.invalida,
    getSize: () => ({ width, height }),
    resize: (opcoes: { width: number; height: number }) => {
      ambiente.redimensionar(opcoes);
      return criarImagem(opcoes.width, opcoes.height);
    },
    // Basta um pixel para representar a presença ou ausência de transparência.
    toBitmap: () => Buffer.from([0, 0, 0, ambiente.transparente ? 0 : 255]),
    toJPEG: (qualidade: number) => {
      ambiente.codificar('jpeg', qualidade);
      return ambiente.vazia ? Buffer.alloc(0) : ambiente.maior ? Buffer.alloc(4096) : Buffer.from(`jpeg:${width}x${height}:${qualidade}`);
    },
    toPNG: () => { ambiente.codificar('png'); return Buffer.from(`png:${width}x${height}`); },
  });
  return {
    app: { getPath: () => ambiente.diretorio, getVersion: () => '0.1.22', getAppPath: () => ambiente.diretorio },
    ipcMain: { handle: vi.fn() },
    nativeImage: { createFromBuffer: (bytes: Buffer) => {
      const dimensoes = bytes.toString().match(/^(?:jpeg|png):(\d+)x(\d+)/);
      return criarImagem(dimensoes ? Number(dimensoes[1]) : ambiente.largura, dimensoes ? Number(dimensoes[2]) : ambiente.altura);
    } },
  };
});

let sqlite: typeof import('../../main/database/sqlite');
let imagens: typeof import('../../main/services/imagem-laudo.service');
let reps: typeof import('../../main/services/rep.service')['repService'];
let atualizar: (evento: Electron.IpcMainInvokeEvent, id: string, status: string) => Promise<{ success: boolean; error?: string }>;
let sequencia = 0;
let laudoId: string;

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const registros = () => sqlite.executeQuery<{ id: string; caminho_relativo: string; mime_type: string; tamanho: number;
  sha256: string; imagem_origem_id: string | null; ajustes_json: string | null; disponivel_painel: number; temporaria_sessao: number }>(
  'SELECT * FROM imagens_laudo WHERE laudo_id = ? ORDER BY id', [laudoId]);
const conteudo = async (html: string) => sqlite.executeNonQuery('UPDATE laudos SET conteudo = ? WHERE id = ?', [html, laudoId]);
const concluir = () => atualizar({} as Electron.IpcMainInvokeEvent, laudoId, 'Concluído');

async function adicionar(id = 'foto', mime = 'image/jpeg', bytes = Buffer.alloc(2048, 1)) {
  const imagemId = `${laudoId}-${id}`;
  const relativo = `imagens/laudos/${laudoId}/${id}.original`;
  await mkdir(path.dirname(path.join(ambiente.diretorio, relativo)), { recursive: true });
  await writeFile(path.join(ambiente.diretorio, relativo), bytes);
  await sqlite.executeNonQuery(`INSERT INTO imagens_laudo
    (id, laudo_id, nome_arquivo, caminho_relativo, mime_type, tamanho, sha256, origem, sequencia, disponivel_painel, temporaria_sessao, ajustes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'local', 1, 1, 1, '{"recorte":true}')`,
  [imagemId, laudoId, id, relativo, mime, bytes.length, hash(bytes)]);
  return { id: imagemId, relativo, bytes };
}

beforeAll(async () => {
  ambiente.diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-conclusao-'));
  sqlite = await import('../../main/database/sqlite');
  await (await import('../../main/database/index')).setupDatabase();
  imagens = await import('../../main/services/imagem-laudo.service');
  reps = (await import('../../main/services/rep.service')).repService;
  await sqlite.executeNonQuery("INSERT INTO users (id, nome, email, username, senha_hash) VALUES ('perito-regressao', 'Perito', 'teste@local.invalid', 'perito-regressao', 'hash')");
  await sqlite.executeNonQuery("INSERT INTO templates (id, nome) VALUES ('template-regressao', 'Teste')");
  (await import('../../main/ipc/handlers/laudo.handlers')).registerLaudoHandlers();
  const handler = vi.mocked(ipcMain.handle).mock.calls.find(([nome]) => nome === 'laudo:updateStatus')?.[1];
  if (!handler) throw new Error('Handler não registrado');
  atualizar = handler;
});

beforeEach(async () => {
  Object.assign(ambiente, { largura: 4000, altura: 2000, transparente: false, invalida: false, vazia: false, maior: false });
  laudoId = `conclusao-${++sequencia}`;
  await sqlite.executeNonQuery("DELETE FROM configuracoes WHERE chave = 'perfil_figura_laudo'");
  await sqlite.executeNonQuery('INSERT INTO reps (id, numero, data_requisicao) VALUES (?, ?, ?)', [laudoId, laudoId, '2026-10-28']);
  await sqlite.executeNonQuery(`INSERT INTO laudos (id, rep_id, perito_id, template_id, conteudo, status)
    VALUES (?, ?, 'perito-regressao', 'template-regressao', '', 'Em andamento')`, [laudoId, laudoId]);
});

afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await sqlite?.closeDatabase(); if (ambiente.diretorio) await rm(ambiente.diretorio, { recursive: true, force: true }); });

describe('compressão, integridade e conclusão das figuras', () => {
  it.each([
    ['nitido', 2048, 85], ['equilibrado', 1600, 78], ['compacto', 1280, 70],
    ['maxima_economia', 1024, 62], [null, 1024, 62], ['invalido', 1024, 62],
  ] as const)('imprime com perfil %s sem modificar o arquivo persistido', async (perfil, lado, qualidade) => {
    if (perfil) await sqlite.executeNonQuery('INSERT INTO configuracoes (chave, valor, tipo) VALUES (?, ?, ?)', ['perfil_figura_laudo', perfil, 'string']);
    const foto = await adicionar();
    const antes = await registros();
    const resposta = await imagens.obterImagemImpressaoLaudo(laudoId, foto.id, 3000);
    expect(Buffer.from(resposta.dataUri.split(',')[1], 'base64').toString()).toBe(`jpeg:${lado}x${lado / 2}:${qualidade}`);
    expect(ambiente.codificar).toHaveBeenCalledWith('jpeg', qualidade);
    expect(await registros()).toEqual(antes);
    expect(await readFile(path.join(ambiente.diretorio, foto.relativo))).toEqual(foto.bytes);
  });

  it.each([[320, 180, 320, 180], [1000, 4000, 256, 1024], [4000, 2000, 400, 200]])(
    'preserva proporção de %sx%s e respeita a largura final', async (largura, altura, finalLargura, finalAltura) => {
      ambiente.largura = largura; ambiente.altura = altura;
      const foto = await adicionar();
      const resposta = await imagens.obterImagemImpressaoLaudo(laudoId, foto.id, 400);
      expect(Buffer.from(resposta.dataUri.split(',')[1], 'base64').toString()).toBe(`jpeg:${finalLargura}x${finalAltura}:62`);
      if (largura === 320) expect(ambiente.redimensionar).not.toHaveBeenCalled();
    });

  it.each([true, false])('preserva transparência PNG: %s', async transparente => {
    ambiente.transparente = transparente;
    const foto = await adicionar('png', 'image/png');
    const resposta = await imagens.obterImagemImpressaoLaudo(laudoId, foto.id, 3000);
    expect(resposta.dataUri).toMatch(transparente ? /^data:image\/png;/ : /^data:image\/jpeg;/);
    expect(ambiente.codificar).toHaveBeenCalledWith(...(transparente ? ['png'] : ['jpeg', 62]));
  });

  it('conserva MIME e bytes quando a conversão aumenta o arquivo', async () => {
    ambiente.largura = 320; ambiente.altura = 180; ambiente.maior = true;
    const foto = await adicionar('pequena', 'image/jpeg', Buffer.from('original'));
    expect((await imagens.obterImagemImpressaoLaudo(laudoId, foto.id, 3000)).dataUri).toBe(`data:image/jpeg;base64,${foto.bytes.toString('base64')}`);
  });

  it('retém figuras reais uma vez, atualiza metadados e descarta apenas arquivos sem referência', async () => {
    const foto = await adicionar();
    const descartada = await adicionar('descartada');
    await sqlite.executeNonQuery('UPDATE imagens_laudo SET imagem_origem_id = ? WHERE id = ?', [descartada.id, foto.id]);
    imagens.estagiarImagemLaudoPorBytes(laudoId, { id: `${laudoId}-estagiada`, nomeArquivo: 'pendente.jpg', mimeType: 'image/jpeg',
      bytes: Buffer.alloc(64), legenda: '', origem: 'local', sequencia: 3 });
    await conteudo(`<figure data-image-id="${foto.id}" data-image-original-id='${descartada.id}'><img><figcaption>Legenda</figcaption></figure><img data-image-id="${foto.id}"><figure data-dummy="true"><img data-image-id="inexistente"></figure>`);
    const descarteReal = imagens.descartarArquivosConcluidos;
    const descarte = vi.spyOn(imagens, 'descartarArquivosConcluidos').mockImplementation(async (id, caminhos) => {
      // Uma transação aninhada só abre se o commit do handler já ocorreu.
      await sqlite.withTransaction(async () => {
        expect(await sqlite.executeQuery('SELECT status FROM laudos WHERE id = ?', [id])).toEqual([{ status: 'Concluído' }]);
        expect(await readFile(path.join(ambiente.diretorio, foto.relativo))).toEqual(foto.bytes);
      });
      await descarteReal(id, caminhos);
    });
    expect(await concluir()).toMatchObject({ success: true });
    expect(descarte).toHaveBeenCalledTimes(1);
    expect(imagens.listarImagensEstagiadasLaudo(laudoId)).toEqual([]);
    const bytes = Buffer.from('jpeg:1024x512:62');
    const [registro] = await registros();
    expect(await registros()).toHaveLength(1);
    expect(registro).toMatchObject({ id: foto.id, mime_type: 'image/jpeg', tamanho: bytes.length, sha256: hash(bytes),
      imagem_origem_id: null, ajustes_json: null, disponivel_painel: 0, temporaria_sessao: 0 });
    expect(await readFile(path.join(ambiente.diretorio, registro.caminho_relativo))).toEqual(bytes);
    expect(fs.existsSync(path.join(ambiente.diretorio, foto.relativo))).toBe(false);
    expect(fs.existsSync(path.join(ambiente.diretorio, descartada.relativo))).toBe(false);
    const [laudo] = await sqlite.executeQuery<{ conteudo: string }>('SELECT conteudo FROM laudos WHERE id = ?', [laudoId]);
    expect(laudo.conteudo).not.toContain('data-image-original-id');
    expect(laudo.conteudo).toContain('Legenda');
  });

  it('não remove arquivo compartilhado com um registro ainda referenciado', async () => {
    const foto = await adicionar();
    const outra = await adicionar('outra');
    await sqlite.executeNonQuery('UPDATE imagens_laudo SET caminho_relativo = ? WHERE id = ?', [foto.relativo, outra.id]);
    await imagens.descartarArquivosConcluidos(laudoId, [foto.relativo]);
    expect(await readFile(path.join(ambiente.diretorio, foto.relativo))).toEqual(foto.bytes);
  });

  it.each([
    ['ausente', /não está disponível/], ['hash', /verificação de integridade/], ['escrita', /Sem espaço/],
    ['rep', /REP vinculada/], ['invalida', /Figura inválida/], ['vazia', /Não foi possível compactar/],
    ['arquivo', /ENOENT/],
  ] as const)('preserva banco e originais quando ocorre falha: %s', async (falha, mensagem) => {
    const foto = await adicionar();
    await conteudo(`<figure data-image-id="${foto.id}" data-image-original-id="origem"><img></figure>${falha === 'ausente' ? '<img data-image-id="ausente">' : ''}`);
    if (falha === 'hash') await sqlite.executeNonQuery("UPDATE imagens_laudo SET sha256 = 'divergente' WHERE id = ?", [foto.id]);
    if (falha === 'escrita') vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => { throw new Error('Sem espaço'); });
    if (falha === 'rep') vi.spyOn(reps, 'updateStatus').mockResolvedValueOnce(null);
    if (falha === 'arquivo') await rm(path.join(ambiente.diretorio, foto.relativo));
    ambiente.invalida = falha === 'invalida'; ambiente.vazia = falha === 'vazia';
    const antes = await registros();
    const descarte = vi.spyOn(imagens, 'descartarArquivosConcluidos');
    expect(await concluir()).toMatchObject({ success: false, error: expect.stringMatching(mensagem) });
    expect(await registros()).toEqual(antes);
    expect(await sqlite.executeQuery('SELECT status, conteudo FROM laudos WHERE id = ?', [laudoId])).toEqual([
      { status: 'Em andamento', conteudo: expect.stringContaining('data-image-original-id') },
    ]);
    expect(await sqlite.executeQuery('SELECT status FROM reps WHERE id = ?', [laudoId])).toEqual([{ status: 'Pendente' }]);
    if (falha === 'arquivo') expect(fs.existsSync(path.join(ambiente.diretorio, foto.relativo))).toBe(false);
    else expect(await readFile(path.join(ambiente.diretorio, foto.relativo))).toEqual(foto.bytes);
    expect(descarte).not.toHaveBeenCalled();
  });

  it('mantém conclusão confirmada se o descarte falha e não reprocessa status concluído', async () => {
    const foto = await adicionar(); await conteudo(`<img data-image-id="${foto.id}">`);
    const descarte = vi.spyOn(imagens, 'descartarArquivosConcluidos').mockRejectedValue(new Error('Arquivo ocupado'));
    expect(await concluir()).toMatchObject({ success: true });
    expect(await sqlite.executeQuery('SELECT status FROM laudos WHERE id = ?', [laudoId])).toEqual([{ status: 'Concluído' }]);
    const compressao = vi.spyOn(imagens, 'concluirImagensLaudo');
    expect(await concluir()).toMatchObject({ success: true });
    expect(compressao).not.toHaveBeenCalled();
    expect(descarte).toHaveBeenCalledTimes(1);
  });
});
