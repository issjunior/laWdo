import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { criarArquivoBackup, extrairArquivoBackup } from '../../main/services/backup-arquivo.service';

const temporarios: string[] = [];

async function criarDiretorio(): Promise<string> {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-backup-teste-'));
  temporarios.push(diretorio);
  return diretorio;
}

afterEach(async () => {
  await Promise.all(temporarios.splice(0).map(diretorio => rm(diretorio, { recursive: true, force: true })));
});

describe('arquivo de backup protegido', () => {
  it('cifra todo o conteúdo e restaura apenas com a senha correta', async () => {
    const diretorio = await criarDiretorio();
    const arquivo = path.join(diretorio, 'teste.lawdo-backup');
    const conteudo = Buffer.from('perfil sigiloso e chave secreta: exemplo', 'utf8');
    await criarArquivoBackup(arquivo, 'uma-senha-segura-123', 'configuracao', '1.0.0', 1, [
      { nome: 'configuracao.json', conteudo },
    ]);

    const cifrado = await readFile(arquivo);
    expect(cifrado.toString('utf8')).not.toContain('perfil sigiloso');
    await expect(extrairArquivoBackup(arquivo, 'senha-incorreta-123', path.join(diretorio, 'errado')))
      .rejects.toThrow('Senha incorreta ou backup alterado.');

    const manifesto = await extrairArquivoBackup(arquivo, 'uma-senha-segura-123', path.join(diretorio, 'extraido'));
    expect(manifesto.tipo).toBe('configuracao');
    expect(await readFile(path.join(diretorio, 'extraido', 'configuracao.json'))).toEqual(conteudo);
  });

  it('recusa alteração do conteúdo cifrado', async () => {
    const diretorio = await criarDiretorio();
    const arquivo = path.join(diretorio, 'teste.lawdo-backup');
    await criarArquivoBackup(arquivo, 'uma-senha-segura-123', 'completo', '1.0.0', 1, [
      { nome: 'segredos.json', conteudo: Buffer.from('[]') },
    ]);
    const bytes = await readFile(arquivo);
    bytes[bytes.length - 20] ^= 1;
    await writeFile(arquivo, bytes);
    await expect(extrairArquivoBackup(arquivo, 'uma-senha-segura-123', path.join(diretorio, 'extraido')))
      .rejects.toThrow('Senha incorreta ou backup alterado.');
  });

  it('recusa entradas fora do diretório de restauração', async () => {
    const diretorio = await criarDiretorio();
    await expect(criarArquivoBackup(path.join(diretorio, 'invalido.lawdo-backup'), 'uma-senha-segura-123',
      'configuracao', '1.0.0', 1, [{ nome: '../fora.txt', conteudo: Buffer.from('x') }]))
      .rejects.toThrow('Entradas do backup inválidas.');
  });
});
