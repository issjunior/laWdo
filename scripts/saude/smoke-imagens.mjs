import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const indiceExecutavel = process.argv.indexOf('--executavel');
const executavel = indiceExecutavel >= 0 ? process.argv[indiceExecutavel + 1] : undefined;
if (indiceExecutavel >= 0 && !executavel) throw new Error('Executável ausente.');
const raiz = path.resolve('tmp', 'saude-imagens');
await mkdir(raiz, { recursive: true });
const diretorio = await mkdtemp(path.join(raiz, 'execucao-'));
const saida = path.join(diretorio, 'resultado.json');
const processo = spawn(executavel ? path.resolve(executavel) : require('electron'), executavel ? [] : ['.'], {
  env: { ...process.env, LAWDO_SMOKE_IMAGENS: '1', LAWDO_SMOKE_USER_DATA: path.join(diretorio, 'userData'), LAWDO_SMOKE_SAIDA: saida },
  windowsHide: true, stdio: 'inherit',
});
const codigo = await new Promise((resolve, reject) => {
  const prazo = setTimeout(() => { processo.kill(); reject(new Error('Smoke de imagens excedeu 180 segundos.')); }, 180_000);
  processo.once('error', erro => { clearTimeout(prazo); reject(erro); });
  processo.once('exit', valor => { clearTimeout(prazo); resolve(valor ?? 1); });
});
const resultado = JSON.parse(await readFile(saida, 'utf8'));
process.stdout.write(`${JSON.stringify({ diretorio, ...resultado }, null, 2)}\n`);
if (codigo !== 0 || !resultado.sucesso) process.exitCode = 1;
