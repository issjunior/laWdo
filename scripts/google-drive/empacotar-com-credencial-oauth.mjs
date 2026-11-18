import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const recursoTemporario = path.resolve('build', 'google-drive-oauth.dat');

function executar(comando, argumentos) {
  return new Promise((resolve, reject) => {
    const processo = spawn(comando, argumentos, { stdio: 'inherit', env: process.env });
    processo.once('error', reject);
    processo.once('exit', codigo => codigo === 0 ? resolve() : reject(new Error(`Falha ao executar ${comando}.`)));
  });
}

try {
  await executar(npm, ['run', 'build']);
  await executar(npm, ['run', 'preparar:oauth-google-drive']);
  await executar(npm, ['exec', '--', 'electron-builder', ...process.argv.slice(2)]);
} finally {
  await rm(recursoTemporario, { force: true });
}
