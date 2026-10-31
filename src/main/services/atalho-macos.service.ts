import { app } from 'electron';
import { lstat, mkdir, readFile, realpath, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getLogger } from '../utils/logger.js';

function arquivoAusente(erro: unknown): boolean {
  return erro !== null && typeof erro === 'object' && 'code' in erro && erro.code === 'ENOENT';
}

async function atalhoJaCriado(registro: string): Promise<boolean> {
  let conteudo: string;
  try {
    conteudo = await readFile(registro, 'utf8');
  } catch (erro) {
    if (arquivoAusente(erro)) return false;
    throw erro;
  }
  const estado: unknown = JSON.parse(conteudo);
  if (!estado || typeof estado !== 'object' || !('versao' in estado) || estado.versao !== 1
    || !('criado' in estado) || estado.criado !== true) {
    throw new Error('Registro de criação do atalho macOS inválido.');
  }
  return true;
}

export async function criarAtalhoMesaMacOS(): Promise<void> {
  if (process.platform !== 'darwin' || !app.isPackaged || process.getuid?.() === 0
    || process.env.LAWDO_SMOKE_SCHEMA === '1' || process.env.LAWDO_SMOKE_JANELA === '1'
    || process.env.LAWDO_TESTE_CARGA === '1') return;

  const log = getLogger('sistema');
  try {
    const diretorio = path.join(app.getPath('userData'), 'integracao-desktop');
    const registro = path.join(diretorio, 'macos.json');
    if (await atalhoJaCriado(registro)) return;

    const executavel = await realpath(app.getPath('exe'));
    const aplicativo = path.resolve(path.dirname(executavel), '..', '..');
    if (!aplicativo.endsWith('.app') || path.basename(path.dirname(executavel)) !== 'MacOS'
      || path.basename(path.dirname(path.dirname(executavel))) !== 'Contents') return;

    const pastaPessoal = app.getPath('home');
    const pastasAplicativos = [path.resolve('/Applications'), path.join(pastaPessoal, 'Applications')];
    const instalado = pastasAplicativos.some(pasta => {
      const relativo = path.relative(pasta, aplicativo);
      return relativo !== '' && relativo !== '..' && !relativo.startsWith(`..${path.sep}`) && !path.isAbsolute(relativo);
    });
    if (!instalado || !(await stat(aplicativo)).isDirectory()) return;

    const mesa = app.getPath('desktop');
    if (!path.isAbsolute(mesa) || !(await stat(mesa)).isDirectory()
      || await realpath(mesa) === await realpath(pastaPessoal)) {
      throw new Error('Mesa ausente ou configurada como a pasta pessoal.');
    }
    const atalho = path.join(mesa, 'laWdo.app');
    try {
      await lstat(atalho);
      log.warn('Atalho existente na Mesa preservado.', { atalho });
      return;
    } catch (erro) {
      if (!arquivoAusente(erro)) throw erro;
    }

    await mkdir(diretorio, { recursive: true });
    await symlink(aplicativo, atalho, 'dir');
    await writeFile(registro, JSON.stringify({ versao: 1, criado: true }), { flag: 'wx', mode: 0o600 });
    log.info('Atalho do laWdo criado na Mesa.', { atalho });
  } catch (erro) {
    log.warn('Não foi possível preparar o atalho do macOS.', {
      erro: erro instanceof Error ? erro.message : 'Erro inesperado',
    });
  }
}
