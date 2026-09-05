import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const caminhoSchema = resolve('src/main/database/index.ts');
const conteudoSchema = await readFile(caminhoSchema, 'utf8');
const correspondencia = conteudoSchema.match(/export const CURRENT_SCHEMA_VERSION = (\d+);/);

if (!correspondencia) {
  throw new Error('Não foi possível identificar CURRENT_SCHEMA_VERSION no banco de dados.');
}

export const versaoSchemaAtual = Number(correspondencia[1]);

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.stdout.write(`${versaoSchemaAtual}\n`);
}
