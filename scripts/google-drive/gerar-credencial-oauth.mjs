import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const clienteId = '493123012522-b3qcb2uuic75ppbig2h0glnbfi0pie63.apps.googleusercontent.com';
const diretorioBuild = path.resolve('build');
const arquivoLocal = path.join(diretorioBuild, 'google-drive-oauth.local');
const arquivoSaida = path.join(diretorioBuild, 'google-drive-oauth.dat');

async function obterSegredo() {
  const peloAmbiente = process.env.LAWDO_GOOGLE_CLIENT_SECRET?.trim();
  if (peloAmbiente) return peloAmbiente;
  try {
    return (await readFile(arquivoLocal, 'utf8')).trim();
  } catch {
    throw new Error('A credencial OAuth do Google Drive não foi provisionada para este empacotamento.');
  }
}

function transformar(dados, nonce) {
  const mascara = createHash('sha256').update(`laWdo/google-drive/oauth/v1/${clienteId}/`).update(nonce).digest();
  return Buffer.from(dados.map((byte, indice) => byte ^ mascara[indice % mascara.length]));
}

const segredo = await obterSegredo();
if (segredo.length < 8 || segredo.length > 2048 || /[\r\n]/.test(segredo)) throw new Error('A credencial OAuth do Google Drive tem formato inválido.');
const nonce = randomBytes(24);
const dados = transformar(Buffer.from(segredo, 'utf8'), nonce);
await mkdir(diretorioBuild, { recursive: true });
await writeFile(arquivoSaida, `${JSON.stringify({ versao: 1, nonce: nonce.toString('base64'), dados: dados.toString('base64') })}\n`, { encoding: 'utf8', mode: 0o600 });
process.stdout.write('Credencial OAuth do Google Drive preparada para o empacotamento.\n');
