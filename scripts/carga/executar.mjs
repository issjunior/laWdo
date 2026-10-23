import { Worker } from 'node:worker_threads';

// Sinais ficam no supervisor; o Playwright no worker não interrompe a gravação final.
const executor = new Worker(new URL('./executor.mjs', import.meta.url), { argv: process.argv.slice(2), execArgv: [] });
const cancelar = () => executor.postMessage('cancelar');
process.on('SIGINT', cancelar);
process.on('SIGTERM', cancelar);
try {
  process.exitCode = await new Promise((resolver, rejeitar) => {
    executor.once('exit', resolver);
    executor.once('error', rejeitar);
  });
} finally {
  process.off('SIGINT', cancelar);
  process.off('SIGTERM', cancelar);
}
