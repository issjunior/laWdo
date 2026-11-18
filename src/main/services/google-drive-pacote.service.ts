import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const ASSINATURA = Buffer.from('LAWDO-DRIVE-1\n', 'ascii');
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;
const LIMITE_PACOTE = 20 * 1024 * 1024 * 1024;

function validarChave(chave: Buffer): void {
  if (chave.length !== 32) throw new Error('Chave de cifragem do Google Drive inválida.');
}

async function validarArquivo(caminho: string): Promise<number> {
  const informacoes = await stat(caminho);
  if (!informacoes.isFile() || informacoes.size < 1 || informacoes.size > LIMITE_PACOTE) throw new Error('Tamanho do pacote do Google Drive inválido.');
  return informacoes.size;
}

export async function cifrarPacoteGoogleDrive(origem: string, destino: string, chave: Buffer): Promise<void> {
  validarChave(chave);
  await validarArquivo(origem);
  const temporario = `${destino}.${randomBytes(8).toString('hex')}.tmp`;
  const iv = randomBytes(TAMANHO_IV);
  try {
    await mkdir(path.dirname(destino), { recursive: true });
    const arquivo = await open(temporario, 'wx');
    await arquivo.write(Buffer.concat([ASSINATURA, iv]));
    await arquivo.close();
    const cifra = createCipheriv('aes-256-gcm', chave, iv);
    await pipeline(createReadStream(origem), cifra, createWriteStream(temporario, { flags: 'a' }));
    const saida = await open(temporario, 'a');
    try { await saida.write(cifra.getAuthTag()); }
    finally { await saida.close(); }
    await validarArquivo(temporario);
    await rename(temporario, destino);
  } finally {
    await rm(temporario, { force: true }).catch(() => undefined);
  }
}

export async function decifrarPacoteGoogleDrive(origem: string, destino: string, chave: Buffer): Promise<void> {
  validarChave(chave);
  const tamanho = await validarArquivo(origem);
  if (tamanho <= ASSINATURA.length + TAMANHO_IV + TAMANHO_TAG) throw new Error('Pacote do Google Drive truncado.');
  const arquivo = await open(origem, 'r');
  let cabecalho: Buffer;
  let tag: Buffer;
  try {
    cabecalho = Buffer.alloc(ASSINATURA.length + TAMANHO_IV);
    await arquivo.read(cabecalho, 0, cabecalho.length, 0);
    tag = Buffer.alloc(TAMANHO_TAG);
    await arquivo.read(tag, 0, tag.length, tamanho - TAMANHO_TAG);
  } finally { await arquivo.close(); }
  if (!cabecalho.subarray(0, ASSINATURA.length).equals(ASSINATURA)) throw new Error('Formato de pacote do Google Drive não reconhecido.');
  const temporario = `${destino}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    await mkdir(path.dirname(destino), { recursive: true });
    const decifra = createDecipheriv('aes-256-gcm', chave, cabecalho.subarray(ASSINATURA.length));
    decifra.setAuthTag(tag);
    await pipeline(createReadStream(origem, { start: ASSINATURA.length + TAMANHO_IV, end: tamanho - TAMANHO_TAG - 1 }), decifra, createWriteStream(temporario, { flags: 'wx' }));
    await validarArquivo(temporario);
    await rename(temporario, destino);
  } finally {
    await rm(temporario, { force: true }).catch(() => undefined);
  }
}

export function criarChavePacoteGoogleDrive(): Buffer {
  return randomBytes(32);
}
