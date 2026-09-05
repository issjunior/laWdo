import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function argumento(nome) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] : undefined;
}

function executar(comando, argumentos, ambiente) {
  return new Promise((resolveExecucao, reject) => {
    const processo = spawn(comando, argumentos, { env: ambiente, stdio: 'inherit' });
    const temporizador = setTimeout(() => {
      processo.kill();
      reject(new Error('Smoke de schema excedeu 60 segundos.'));
    }, 60_000);
    processo.once('error', erro => {
      clearTimeout(temporizador);
      reject(erro);
    });
    processo.once('exit', codigo => {
      clearTimeout(temporizador);
      resolveExecucao(codigo ?? 1);
    });
  });
}

const executavel = argumento('--executavel');
const diretorioTemporario = await mkdtemp(join(tmpdir(), 'lawdo-smoke-schema-'));
const caminhoRelatorio = join(diretorioTemporario, 'resultado.json');

try {
  const comando = executavel ? resolve(executavel) : resolve('node_modules/electron/dist/electron.exe');
  const argumentos = executavel ? [] : ['.'];
  const codigo = await executar(comando, argumentos, {
    ...process.env,
    LAWDO_SMOKE_SCHEMA: '1',
    LAWDO_SMOKE_USER_DATA: join(diretorioTemporario, 'userData'),
    LAWDO_SMOKE_SAIDA: caminhoRelatorio,
  });
  const resultado = JSON.parse(await readFile(caminhoRelatorio, 'utf8'));
  if (codigo !== 0 || resultado.sucesso !== true) {
    throw new Error(`Smoke de schema falhou: ${resultado.erro ?? 'resultado inválido'}.`);
  }
  process.stdout.write(`Smoke de schema concluído na versão ${resultado.versaoSchema}.\n`);
} finally {
  await rm(diretorioTemporario, { recursive: true, force: true });
}
