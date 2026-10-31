import { app } from 'electron';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, copyFile, lstat, mkdir, open, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { getLogger } from '../utils/logger.js';

const executarArquivo = promisify(execFile);

function codigoErro(erro: unknown): unknown {
  return erro !== null && typeof erro === 'object' && 'code' in erro ? erro.code : undefined;
}

function calcularHash(conteudo: string): string {
  return createHash('sha256').update(conteudo).digest('hex');
}

async function lerHashRegistrado(caminho: string): Promise<string | undefined> {
  let conteudo: string;
  try {
    conteudo = await readFile(caminho, 'utf8');
  } catch (erro) {
    if (codigoErro(erro) === 'ENOENT') return undefined;
    throw erro;
  }
  const estado: unknown = JSON.parse(conteudo);
  if (!estado || typeof estado !== 'object' || !('versao' in estado) || estado.versao !== 1
    || !('hash' in estado) || typeof estado.hash !== 'string' || !/^[a-f0-9]{64}$/.test(estado.hash)) {
    throw new Error('Registro de criação do atalho inválido.');
  }
  return estado.hash;
}

function escaparValor(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

function gerarEntrada(executavel: string, icone: string, appImage: boolean): string {
  if (executavel.includes('=') || Array.from(executavel).some(caractere => caractere.charCodeAt(0) < 32 || caractere.charCodeAt(0) === 127)) {
    throw new Error('Caminho do executável incompatível com o formato Desktop Entry.');
  }
  // Exec passa primeiro pelo escape de string e depois pelo de argumento do Desktop Entry.
  const comando = escaparValor(executavel.replace(/[\\"`$]/g, '\\$&').replace(/%/g, '%%'));
  return [
    '[Desktop Entry]',
    'Version=1.0',
    'Type=Application',
    `Name=${appImage ? 'laWdo (AppImage)' : 'laWdo'}`,
    'Comment=Sistema de Laudos Periciais',
    `Exec="${comando}"`,
    `Icon=${escaparValor(icone)}`,
    'Terminal=false',
    'Categories=Office;',
    'X-laWdo-Gerenciado=true',
    '',
  ].join('\n');
}

export async function criarAtalhoDesktopLinux(): Promise<void> {
  if (process.platform !== 'linux' || !app.isPackaged || process.getuid?.() === 0
    || process.env.LAWDO_SMOKE_SCHEMA === '1' || process.env.LAWDO_SMOKE_JANELA === '1'
    || process.env.LAWDO_TESTE_CARGA === '1') return;

  const log = getLogger('sistema');
  try {
    const desktop = app.getPath('desktop');
    if (!path.isAbsolute(desktop) || !await stat(desktop).then(entrada => entrada.isDirectory())
      || await realpath(desktop) === await realpath(app.getPath('home'))) {
      throw new Error('Área de trabalho ausente ou configurada como a pasta pessoal.');
    }
    const appImage = process.env.APPIMAGE !== undefined;
    const executavel = appImage ? process.env.APPIMAGE : app.getPath('exe');
    if (!executavel || !path.isAbsolute(executavel) || !await stat(executavel).then(entrada => entrada.isFile())) {
      throw new Error('Executável do atalho ausente ou com caminho inválido.');
    }

    const diretorio = path.join(app.getPath('userData'), 'integracao-desktop');
    const registro = path.join(diretorio, `${appImage ? 'appimage' : 'deb'}.json`);
    const atalho = path.join(desktop, appImage ? 'laWdo-AppImage.desktop' : 'laWdo.desktop');
    const icone = path.join(diretorio, 'icone.png');
    const conteudo = gerarEntrada(executavel, icone, appImage);
    const hashAnterior = await lerHashRegistrado(registro);
    let conteudoAnterior: string | undefined;
    try {
      const entrada = await lstat(atalho);
      if (!entrada.isFile() || entrada.isSymbolicLink()) {
        throw new Error('O caminho do atalho já está ocupado por outro arquivo ou link.');
      }
      conteudoAnterior = await readFile(atalho, 'utf8');
    } catch (erro) {
      if (codigoErro(erro) !== 'ENOENT') throw erro;
    }

    if (conteudoAnterior === undefined && hashAnterior !== undefined) return;
    if (conteudoAnterior !== undefined && (!hashAnterior || calcularHash(conteudoAnterior) !== hashAnterior)) {
      log.warn('Atalho existente preservado por não corresponder ao arquivo criado pelo laWdo.');
      return;
    }
    if (conteudoAnterior === conteudo) return;

    await mkdir(diretorio, { recursive: true });
    await copyFile(path.join(process.resourcesPath, 'assets', 'icone-linux.png'), icone);
    if (conteudoAnterior === undefined) {
      await writeFile(atalho, conteudo, { flag: 'wx', mode: 0o755 });
    } else {
      const arquivo = await open(atalho, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0) | constants.O_NONBLOCK);
      try {
        if (!(await arquivo.stat()).isFile() || await arquivo.readFile('utf8') !== conteudoAnterior) {
          throw new Error('Atalho modificado durante a atualização; arquivo preservado.');
        }
        await arquivo.write(conteudo, 0, 'utf8');
        await arquivo.truncate(Buffer.byteLength(conteudo));
      } finally {
        await arquivo.close();
      }
    }
    await chmod(atalho, 0o755);
    await writeFile(registro, JSON.stringify({ versao: 1, hash: calcularHash(conteudo) }), { mode: 0o600 });
    log.info('Atalho do laWdo criado ou atualizado na área de trabalho.', { atalho });
    try {
      await executarArquivo('gio', ['set', atalho, 'metadata::trusted', 'true'], { timeout: 3_000 });
      log.info('Confiança do atalho registrada pelo gio.', { atalho });
    } catch (erro) {
      log.warn('Atalho criado; o ambiente gráfico pode exigir “Permitir iniciar”.', {
        erro: erro instanceof Error ? erro.message : 'Erro inesperado',
      });
    }
  } catch (erro) {
    log.warn('Não foi possível preparar o atalho do Linux.', {
      erro: erro instanceof Error ? erro.message : 'Erro inesperado',
    });
  }
}
