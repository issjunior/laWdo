import { Worker } from 'worker_threads';
import { ehResultadoImportacaoTemplate, type ResultadoImportacaoTemplate } from '../../shared/types/importacao-template.types.js';

let importacaoEmAndamento = false;

export async function importarDocumento(caminho: string): Promise<ResultadoImportacaoTemplate> {
  if (importacaoEmAndamento) throw new Error('Uma importação já está em andamento. Aguarde a conclusão.');
  importacaoEmAndamento = true;
  try {
    return await new Promise<ResultadoImportacaoTemplate>((resolve, reject) => {
      const worker = new Worker(new URL('./importacao/worker.js', import.meta.url), {
        workerData: caminho, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 },
      });
      let concluido = false;
      const finalizar = (erro?: Error, resultado?: ResultadoImportacaoTemplate) => {
        if (concluido) return;
        concluido = true;
        clearTimeout(temporizador);
        void worker.terminate();
        if (erro) reject(erro);
        else if (resultado) resolve(resultado);
      };
      const temporizador = setTimeout(() => finalizar(new Error('Importação excedeu 60 segundos. Reduza o documento e tente novamente.')), 60_000);
      worker.once('message', (mensagem: unknown) => {
        if (mensagem && typeof mensagem === 'object' && 'success' in mensagem) {
          if (mensagem.success === true && 'data' in mensagem && ehResultadoImportacaoTemplate(mensagem.data)) {
            finalizar(undefined, mensagem.data); return;
          }
          if (mensagem.success === false && 'error' in mensagem && typeof mensagem.error === 'string') {
            finalizar(new Error(mensagem.error)); return;
          }
        }
        finalizar(new Error('Resposta inválida do leitor de documentos'));
      });
      worker.once('error', () => finalizar(new Error('Falha no leitor de documentos. O arquivo pode exceder os limites de processamento.')));
      worker.once('exit', () => { if (!concluido) finalizar(new Error('Leitor de documentos encerrado sem resultado')); });
    });
  } finally {
    importacaoEmAndamento = false;
  }
}
