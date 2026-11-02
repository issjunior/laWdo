import { transformarImagem } from './transformar.js';
import { transformacaoImagemValida } from './contratos.js';

let ocupada = false;
process.parentPort?.on('message', async (evento: { data: unknown }) => {
  const mensagem = evento.data;
  if (!mensagem || typeof mensagem !== 'object' || !('id' in mensagem) || typeof mensagem.id !== 'number') return;
  const id = mensagem.id;
  if (ocupada || !('entrada' in mensagem) || !transformacaoImagemValida(mensagem.entrada)) {
    process.parentPort?.postMessage({ id, erro: 'Tarefa de imagem inválida.' });
    return;
  }
  ocupada = true;
  try { process.parentPort?.postMessage({ id, resultado: await transformarImagem(mensagem.entrada) }); }
  catch (erro) { process.parentPort?.postMessage({ id, erro: erro instanceof Error ? erro.message : 'Falha ao processar imagem.' }); }
  finally { ocupada = false; }
});
