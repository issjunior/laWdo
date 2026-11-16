import { app } from 'electron';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const CLIENT_ID_GOOGLE_DRIVE = '493123012522-b3qcb2uuic75ppbig2h0glnbfi0pie63.apps.googleusercontent.com';

interface CredencialOfuscada {
  versao: 1;
  nonce: string;
  dados: string;
}

function caminhoCredencial(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'config', 'google-drive-oauth.dat')
    : path.join(app.getAppPath(), 'build', 'google-drive-oauth.dat');
}

function ehCredencialOfuscada(valor: unknown): valor is CredencialOfuscada {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const dados = valor as Record<string, unknown>;
  return dados.versao === 1 && typeof dados.nonce === 'string' && typeof dados.dados === 'string';
}

function transformar(dados: Buffer, nonce: Buffer): Buffer {
  const mascara = createHash('sha256').update(`laWdo/google-drive/oauth/v1/${CLIENT_ID_GOOGLE_DRIVE}/`).update(nonce).digest();
  return Buffer.from(dados.map((byte, indice) => byte ^ mascara[indice % mascara.length]!));
}

export async function obterSegredoClienteGoogleDrive(): Promise<string | null> {
  try {
    const bruto: unknown = JSON.parse(await readFile(caminhoCredencial(), 'utf8'));
    if (!ehCredencialOfuscada(bruto)) return null;
    const nonce = Buffer.from(bruto.nonce, 'base64');
    const dados = Buffer.from(bruto.dados, 'base64');
    if (nonce.length < 16 || dados.length === 0) return null;
    const segredo = transformar(dados, nonce).toString('utf8');
    return segredo.length >= 8 && segredo.length <= 2048 && !/[\r\n]/.test(segredo) ? segredo : null;
  } catch {
    return null;
  }
}
