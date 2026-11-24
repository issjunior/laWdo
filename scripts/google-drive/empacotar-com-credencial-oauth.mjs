import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const recursoTemporario = path.resolve('build', 'google-drive-oauth.dat');
const argumentos = process.argv.slice(2);
const semCredencial = argumentos[0] === '--sem-credencial';
const argumentosBuilder = semCredencial ? argumentos.slice(1) : argumentos;

function executar(comando, argumentosExecucao) {
  return new Promise((resolve, reject) => {
    const processo = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', comando, ...argumentosExecucao], { stdio: 'inherit', env: process.env })
      : spawn(comando, argumentosExecucao, { stdio: 'inherit', env: process.env });
    processo.once('error', reject);
    processo.once('exit', codigo => codigo === 0 ? resolve() : reject(new Error(`Falha ao executar ${comando}.`)));
  });
}

try {
  await rm(recursoTemporario, { force: true });
  if (semCredencial) {
    await mkdir(path.dirname(recursoTemporario), { recursive: true });
    await writeFile(recursoTemporario, '{}\n', { encoding: 'utf8', mode: 0o600 });
  } else {
    await executar(npm, ['run', 'preparar:oauth-google-drive']);
  }
  await executar(npm, ['run', 'build']);
  await executar(npm, ['exec', '--', 'electron-builder', ...argumentosBuilder]);
} finally {
  await rm(recursoTemporario, { force: true });
}
