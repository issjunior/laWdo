import { afterEach, expect, it, vi } from 'vitest';
import { FilaImagens } from '../../main/services/imagens/fila';
import type { ImagemTransformada, TransformacaoImagem } from '../../main/services/imagens/contratos';

const entrada: TransformacaoImagem = { bytes: Buffer.from('imagem'), finalidade: 'miniatura', qualidade: 75, formato: 'jpeg', mimeOriginal: 'image/jpeg' };
const imagem = { bytes: Buffer.from('derivada'), mimeType: 'image/jpeg' };
function preparar(limite = 30) {
  const resolucoes: Array<(valor: ImagemTransformada) => void> = [];
  const executar = vi.fn((_entrada: TransformacaoImagem) => new Promise<ImagemTransformada>(resolve => { resolucoes.push(resolve); }));
  const interromper = vi.fn();
  const fila = new FilaImagens(executar, interromper, limite);
  return { fila, executar, interromper, concluir: () => resolucoes.shift()?.(imagem) };
}
async function avancar() { for (let indice = 0; indice < 8; indice++) await Promise.resolve(); }
afterEach(() => vi.useRealTimers());

it('deduplica trabalho e mantém consumidores independentes', async () => {
  const { fila, executar, concluir } = preparar();
  const primeira = fila.solicitar('mesma', entrada, 'painel-a', 1);
  const segunda = fila.solicitar('mesma', entrada, 'painel-b', 0);
  const cancelada = expect(primeira).rejects.toThrow('cancelado');
  fila.cancelar('painel-a'); await avancar();
  expect(executar).toHaveBeenCalledTimes(1);
  concluir(); await expect(segunda).resolves.toEqual(imagem); await cancelada;
  fila.encerrar();
});

it('prioriza a prévia e limita tarefas pendentes sem iniciar conversões em paralelo', async () => {
  const { fila, executar, concluir } = preparar(2);
  const ativa = fila.solicitar('ativa', entrada, 'a', 1);
  const antecipada = fila.solicitar('antecipada', entrada, 'a', 1);
  const previa = fila.solicitar('previa', { ...entrada, finalidade: 'previa' }, 'a', 0);
  await expect(fila.solicitar('excesso', entrada, 'a', 0)).rejects.toThrow('cheia');
  await avancar(); expect(executar).toHaveBeenCalledTimes(1);
  concluir(); await ativa; await avancar();
  expect(executar.mock.calls.at(-1)?.[0]?.finalidade).toBe('previa');
  concluir(); await previa; await avancar(); concluir(); await antecipada;
  fila.encerrar();
});

it('encerra uma tarefa travada sem repeti-la e permite nova solicitação', async () => {
  vi.useFakeTimers();
  const { fila, executar, interromper, concluir } = preparar();
  const primeira = fila.solicitar('travada', entrada, 'a', 1);
  const falha = expect(primeira).rejects.toThrow('30 segundos');
  await vi.advanceTimersByTimeAsync(30_000); await falha;
  expect(interromper).toHaveBeenCalledTimes(1); expect(executar).toHaveBeenCalledTimes(1);
  // A resolução tardia da tarefa vencida não deve satisfazer uma tarefa nova.
  concluir();
  const nova = fila.solicitar('nova', entrada, 'a', 0);
  await vi.advanceTimersByTimeAsync(0); concluir(); await expect(nova).resolves.toEqual(imagem);
  fila.encerrar();
});

it('retira tarefas canceladas antes de executá-las e rejeita chamadas após encerramento', async () => {
  const { fila, executar, concluir } = preparar();
  const ativa = fila.solicitar('ativa', entrada, 'a', 0);
  const pendente = fila.solicitar('pendente', entrada, 'b', 1);
  const cancelada = expect(pendente).rejects.toThrow('cancelado');
  fila.cancelar('b'); await cancelada; await avancar(); concluir(); await ativa; await avancar();
  expect(executar).toHaveBeenCalledTimes(1);
  fila.encerrar(); await expect(fila.solicitar('nova', entrada, 'a', 1)).rejects.toThrow('encerrado');
});
