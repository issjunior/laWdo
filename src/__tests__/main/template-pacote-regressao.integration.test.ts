import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let diretorio: string;
let sqlite: typeof import('../../main/database/sqlite');
let servico: typeof import('../../main/services/template-pacote.service');

const secao = { id_origem: 'pai', parent_id_origem: null, nome: 'Primeira', ordem: 0, conteudo: '<p>Preservado</p>' };
function criarPayload() {
  return { template: { nome: 'Sintético' }, tipo_exame: { codigo: 'REGRESSAO-PACOTE', nome: 'Exame sintético' },
    secoes: [secao, { ...secao, id_origem: 'filha', parent_id_origem: 'pai', nome: 'Segunda', ordem: 1 }] };
}

async function escreverPacote(payload: unknown, adulterado = false) {
  const dados = Buffer.from(JSON.stringify(payload));
  const zip = new AdmZip();
  zip.addFile('template.json', dados);
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({ tipo: 'template', versao: 1,
    checksum: adulterado ? '0'.repeat(64) : createHash('sha256').update(dados).digest('hex') })));
  const caminho = path.join(diretorio, 'template.zip');
  await fs.writeFile(caminho, zip.toBuffer());
  return caminho;
}

async function capturarCadastros() {
  return {
    tipos: await sqlite.executeQuery('SELECT * FROM tipos_exame ORDER BY id'),
    templates: await sqlite.executeQuery('SELECT * FROM templates ORDER BY id'),
    secoes: await sqlite.executeQuery('SELECT * FROM secoes_template ORDER BY id'),
  };
}

beforeAll(async () => {
  vi.stubGlobal('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor);
  diretorio = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-pacote-regressao-'));
  vi.mocked(app.getPath).mockReturnValue(diretorio);
  vi.resetModules();
  sqlite = await import('../../main/database/sqlite');
  await (await import('../../main/database/index')).setupDatabase();
  servico = await import('../../main/services/template-pacote.service');
});
afterAll(async () => {
  await sqlite?.closeDatabase();
  if (diretorio) await fs.rm(diretorio, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('rejeição e atomicidade do pacote de template', () => {
  it.each([
    { caso: 'checksum adulterado', payload: criarPayload(), adulterado: true, erro: 'integridade' },
    { caso: 'estrutura ausente', payload: {}, adulterado: false, erro: 'estrutura' },
    { caso: 'IDs repetidos', payload: { ...criarPayload(), secoes: [secao, secao] }, adulterado: false, erro: 'duplicados' },
    { caso: 'pai inexistente', payload: { ...criarPayload(), secoes: [{ ...secao, parent_id_origem: 'ausente' }] }, adulterado: false, erro: 'pai não encontrada' },
  ])('recusa $caso sem alterar os cadastros', async ({ payload, adulterado, erro }) => {
    const caminho = await escreverPacote(payload, adulterado);
    const antes = await capturarCadastros();
    await expect(servico.lerPreviaPacoteTemplate(caminho)).rejects.toThrow(erro);
    expect(await servico.importarPacoteTemplate(caminho, true)).toEqual({ success: false, error: expect.stringContaining(erro) });
    expect(await capturarCadastros()).toEqual(antes);
  });

  it('exige autorização para criar o tipo ausente e preserva o banco ao recusar', async () => {
    const caminho = await escreverPacote(criarPayload());
    expect((await servico.lerPreviaPacoteTemplate(caminho)).tipoExameExiste).toBe(false);
    const antes = await capturarCadastros();
    expect(await servico.importarPacoteTemplate(caminho, false)).toEqual({ success: false, error: expect.stringContaining('não existe') });
    expect(await capturarCadastros()).toEqual(antes);
  });

  it('reverte tipo, template e primeira seção se a segunda inserção falha, e permite tentar de novo', async () => {
    const caminho = await escreverPacote(criarPayload());
    const antes = await capturarCadastros();
    await sqlite.executeNonQuery("CREATE TRIGGER falha_pacote_regressao BEFORE INSERT ON secoes_template WHEN NEW.nome = 'Segunda' BEGIN SELECT RAISE(ABORT, 'falha sintética na segunda seção'); END");
    try {
      expect(await servico.importarPacoteTemplate(caminho, true)).toEqual({ success: false, error: expect.stringContaining('falha sintética') });
      expect(await capturarCadastros()).toEqual(antes);
      expect(await sqlite.executeQuery('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      await sqlite.executeNonQuery('DROP TRIGGER falha_pacote_regressao');
    }
    expect((await servico.importarPacoteTemplate(caminho, true)).success).toBe(true);
    const templates = await sqlite.executeQuery<{ id: string }>("SELECT id FROM templates WHERE nome = 'Sintético (Importado)'");
    expect(templates).toHaveLength(1);
    const secoes = await sqlite.executeQuery<{ id: string; parent_id: string | null; conteudo: string }>('SELECT * FROM secoes_template WHERE template_id = ? ORDER BY ordem', [templates[0].id]);
    expect(secoes).toHaveLength(2);
    expect(secoes[1].parent_id).toBe(secoes[0].id);
    expect(secoes.map(item => item.conteudo)).toEqual(['<p>Preservado</p>', '<p>Preservado</p>']);
    expect(await sqlite.executeQuery("SELECT id FROM tipos_exame WHERE codigo = 'REGRESSAO-PACOTE'")).toHaveLength(1);
  });
});
