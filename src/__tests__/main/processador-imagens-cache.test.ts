import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { CacheImagens } from '../../main/services/imagens/cache';
let diretorio = '';
afterEach(async () => { if (diretorio) await rm(diretorio, { recursive: true, force: true }); });
async function preparar(memoria = 64, disco = 2048) {
  diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-cache-imagens-'));
  return new CacheImagens(diretorio, memoria, disco);
}
const chave = (numero: number) => numero.toString(16).padStart(64, '0');

it('reutiliza derivados em outra instância sem compartilhar buffers mutáveis', async () => {
  const cache = await preparar();
  const imagem = { bytes: Buffer.from('original'), mimeType: 'image/png' };
  await cache.salvar(chave(1), imagem);
  const primeira = await cache.obter(chave(1)); primeira!.bytes[0] = 0;
  expect((await cache.obter(chave(1)))?.bytes).toEqual(imagem.bytes);
  expect(await new CacheImagens(diretorio).obter(chave(1))).toEqual(imagem);
  expect(await cache.obter(chave(2))).toBeUndefined();
});

it('trata cache corrompido como ausência e rejeita chaves fora do diretório', async () => {
  const cache = await preparar(0);
  await cache.salvar(chave(1), { bytes: Buffer.from('imagem'), mimeType: 'image/jpeg' });
  const arquivo = path.join(diretorio, `${chave(1)}.json`);
  const conteudo = JSON.parse(await readFile(arquivo, 'utf8'));
  await writeFile(arquivo, JSON.stringify({ ...conteudo, bytes: Buffer.from('adulterada').toString('base64') }));
  expect(await cache.obter(chave(1))).toBeUndefined();
  await writeFile(arquivo, '{'); expect(await cache.obter(chave(1))).toBeUndefined();
  await expect(cache.obter('../original')).rejects.toThrow('inválida');
});

it('descarta derivados antigos ao atingir o limite de disco', async () => {
  const cache = await preparar(0, 350);
  for (const numero of [1, 2, 3]) await cache.salvar(chave(numero), { bytes: Buffer.alloc(60, numero), mimeType: 'image/jpeg' });
  const arquivos = await readdir(diretorio);
  const total = (await Promise.all(arquivos.map(arquivo => readFile(path.join(diretorio, arquivo))))).reduce((soma, bytes) => soma + bytes.length, 0);
  expect(total).toBeLessThanOrEqual(350); expect(arquivos.length).toBeLessThan(3);
  expect((await cache.obter(chave(3)))?.bytes).toEqual(Buffer.alloc(60, 3));
});
