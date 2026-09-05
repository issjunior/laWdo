import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizarManifesto } from './manifesto.mjs';
import { versaoSchemaAtual } from './versao-schema.mjs';

function argumento(nome) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] : undefined;
}

const conteudoBanco = await readFile(resolve('src/main/database/index.ts'), 'utf8');
const migrations = [...conteudoBanco.matchAll(/fromVersion < (\d+)/g)].map(correspondencia => Number(correspondencia[1]));
const maiorMigration = Math.max(...migrations);

if (maiorMigration !== versaoSchemaAtual) {
  throw new Error(`Versão do schema (${versaoSchemaAtual}) diverge da maior migration registrada (${maiorMigration}).`);
}

const caminhoManifesto = argumento('--manifesto');
if (caminhoManifesto) {
  const manifesto = normalizarManifesto(JSON.parse(await readFile(resolve(caminhoManifesto), 'utf8')));
  if (manifesto.versaoSchema !== versaoSchemaAtual) {
    throw new Error(`Manifesto informa schema ${manifesto.versaoSchema}, mas o aplicativo informa ${versaoSchemaAtual}.`);
  }
}

process.stdout.write(`Schema ${versaoSchemaAtual} validado.\n`);
