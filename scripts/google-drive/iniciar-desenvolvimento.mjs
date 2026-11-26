import { spawn } from 'node:child_process';
import { access, rm } from 'node:fs/promises';
import path from 'node:path';

const modo = process.argv[2] === 'diagnostico' ? 'diagnostico' : 'normal';
const diretorioProjeto = path.resolve(import.meta.dirname, '..', '..');
const arquivoSegredoLocal = path.join(diretorioProjeto, 'build', 'google-drive-oauth.local');
const arquivoCredencial = path.join(diretorioProjeto, 'build', 'google-drive-oauth.dat');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function executarNpm(argumentos, ambiente = process.env) {
  return new Promise((resolve, reject) => {
    const processo = process.platform === 'win32'
      ? spawn(ambiente.ComSpec || 'cmd.exe', ['/d', '/s', '/c', npm, ...argumentos], { cwd: diretorioProjeto, env: ambiente, stdio: 'inherit' })
      : spawn(npm, argumentos, { cwd: diretorioProjeto, env: ambiente, stdio: 'inherit' });
    processo.once('error', reject);
    processo.once('exit', codigo => codigo === 0 ? resolve() : reject(new Error(`Falha ao executar npm ${argumentos.join(' ')}.`)));
  });
}

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

const possuiSegredoAmbiente = Boolean(process.env.LAWDO_GOOGLE_CLIENT_SECRET?.trim());
const possuiSegredoLocal = await existe(arquivoSegredoLocal);
if (possuiSegredoAmbiente || possuiSegredoLocal) {
  await executarNpm(['run', 'preparar:oauth-google-drive']);
} else {
  await rm(arquivoCredencial, { force: true });
  process.stderr.write('Google Drive: credencial OAuth local não configurada. O laWdo será iniciado sem conexão ao Drive. Consulte scripts/google-drive/README.md.\n');
}

if (modo === 'diagnostico') {
  const ambienteDiagnostico = { ...process.env, LAWDO_MODO_DIAGNOSTICO: '1' };
  await executarNpm(['run', 'build:diagnostico'], ambienteDiagnostico);
  await executarNpm(['exec', '--', 'electron', '.'], ambienteDiagnostico);
} else {
  await executarNpm(['run', 'build']);
  await executarNpm(['exec', '--', 'electron', '.']);
}
