import { parentPort, workerData } from 'worker_threads';
import { executarImportacao } from './pipeline.js';

const caminho: unknown = workerData;
if (typeof caminho !== 'string') throw new Error('Caminho da importação inválido');
try {
  parentPort?.postMessage({ success: true, data: await executarImportacao(caminho) });
} catch (erro: unknown) {
  parentPort?.postMessage({ success: false, error: erro instanceof Error ? erro.message : 'Falha ao processar documento' });
}
