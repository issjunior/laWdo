import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { criarArquivoLaudo, extrairArquivoLaudo } from '../../main/services/laudo-bkp-arquivo.service';

const temporarios: string[] = [];
async function preparar() {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-laudo-bkp-'));
  temporarios.push(diretorio);
  return { diretorio, arquivo: path.join(diretorio, 'laudo.bkp'), destino: path.join(diretorio, 'extraido') };
}
afterEach(async () => {
  await Promise.all(temporarios.splice(0).map(diretorio => rm(diretorio, { recursive: true, force: true })));
});

function entrada(nome: string, dados: Buffer) {
  const cabecalho = Buffer.from(JSON.stringify({ nome, tamanho: dados.length }));
  const prefixo = Buffer.alloc(4);
  prefixo.writeUInt32BE(cabecalho.length);
  return Buffer.concat([prefixo, cabecalho, dados]);
}
function montar(manifesto: unknown, entradas: Array<{ nome: string; dados: Buffer }>, terminar = true) {
  return Buffer.concat([
    Buffer.from('LAWDO-LAUDO-1\n'), entrada('manifesto.json', Buffer.from(JSON.stringify(manifesto))),
    ...entradas.map(item => entrada(item.nome, item.dados)), ...(terminar ? [Buffer.alloc(4)] : []),
  ]);
}
function manifestoDe(nome: string, dados: Buffer) {
  return { formato: 1, tipo: 'laudo', criadoEm: new Date().toISOString(), versaoAplicativo: '1.0.0',
    arquivos: [{ nome, tamanho: dados.length, sha256: createHash('sha256').update(dados).digest('hex') }] };
}

describe('contêiner portável de laudo', () => {
  it('transporta JSON e arquivos binários sem senha e sem depender da versão do banco', async () => {
    const { diretorio, arquivo, destino } = await preparar();
    const figura = Buffer.from([0, 255, 17, 19]);
    const origem = path.join(diretorio, 'figura.png');
    await writeFile(origem, figura);
    await criarArquivoLaudo(arquivo, '0.1.22', [
      { nome: 'laudo.json', conteudo: Buffer.from('{"conteudo":"teste"}') },
      { nome: 'imagens/figura.png', caminho: origem },
    ]);
    const manifesto = await extrairArquivoLaudo(arquivo, destino);
    expect(manifesto.tipo).toBe('laudo');
    expect(manifesto).not.toHaveProperty('versaoSchema');
    expect(await readFile(path.join(destino, 'imagens/figura.png'))).toEqual(figura);
    expect(await readFile(path.join(destino, 'laudo.json'), 'utf8')).toContain('teste');
  });

  it.each(['../fora', '/absoluto', 'C:/fora', 'imagens\\fora', 'a/../fora', 'a//fora', 'manifesto.json'])(
    'recusa nome inseguro ou reservado: %s', async nome => {
      const { arquivo } = await preparar();
      await expect(criarArquivoLaudo(arquivo, '1', [{ nome, conteudo: Buffer.from('x') }])).rejects.toThrow();
    });

  it('recusa nomes duplicados na criação', async () => {
    const { arquivo } = await preparar();
    await expect(criarArquivoLaudo(arquivo, '1', [
      { nome: 'laudo.json', conteudo: Buffer.from('{}') }, { nome: 'laudo.json', conteudo: Buffer.from('{}') },
    ])).rejects.toThrow('repetidas');
  });

  it.each(['hash', 'duplicado', 'modalidade', 'formato', 'caminho', 'sem-terminador', 'extras', 'truncado'])(
    'recusa pacote inválido (%s) e limpa a extração', async defeito => {
      const { arquivo, destino } = await preparar();
      const dados = Buffer.from('{}');
      const manifesto = manifestoDe('laudo.json', dados);
      if (defeito === 'hash') manifesto.arquivos[0].sha256 = '0'.repeat(64);
      if (defeito === 'duplicado') manifesto.arquivos.push(manifesto.arquivos[0]);
      if (defeito === 'modalidade') manifesto.tipo = 'completo';
      if (defeito === 'formato') manifesto.formato = 2;
      if (defeito === 'caminho') manifesto.arquivos[0].nome = '../fora';
      const entradas = [{ nome: 'laudo.json', dados }];
      if (defeito === 'extras') entradas.push({ nome: 'extra', dados });
      const bytes = montar(manifesto, entradas, defeito !== 'sem-terminador');
      await writeFile(arquivo, defeito === 'truncado' ? bytes.subarray(0, bytes.length - 5) : bytes);
      await expect(extrairArquivoLaudo(arquivo, destino)).rejects.toThrow();
      await expect(readFile(path.join(destino, 'laudo.json'))).rejects.toThrow();
    });

  it('não remove um diretório preexistente ao rejeitar a extração', async () => {
    const { arquivo, destino } = await preparar();
    await criarArquivoLaudo(arquivo, '1', [{ nome: 'laudo.json', conteudo: Buffer.from('{}') }]);
    await mkdir(destino);
    await writeFile(path.join(destino, 'preservar'), 'original');
    await expect(extrairArquivoLaudo(arquivo, destino)).rejects.toThrow();
    expect(await readFile(path.join(destino, 'preservar'), 'utf8')).toBe('original');
  });

  it('recusa backup completo no leitor de laudo', async () => {
    const { arquivo, destino } = await preparar();
    await writeFile(arquivo, Buffer.from('LAWDO-BKP-1\nconteudo-antigo'));
    await expect(extrairArquivoLaudo(arquivo, destino)).rejects.toThrow('Formato');
  });
});
