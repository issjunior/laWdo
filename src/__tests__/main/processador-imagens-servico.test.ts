import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TransformacaoImagem } from '../../main/services/imagens/contratos';
const ambiente = vi.hoisted(() => ({ diretorio: '', criar: vi.fn() }));
vi.mock('electron', () => ({ app: { getPath: () => ambiente.diretorio, whenReady: async () => undefined },
  utilityProcess: { fork: ambiente.criar }, nativeImage: {} }));
const entrada: TransformacaoImagem = { bytes: Buffer.from('imagem'), mimeOriginal: 'image/jpeg', finalidade: 'previa', maiorLado: 640, qualidade: 80, formato: 'jpeg' };
let servico: typeof import('../../main/services/processador-imagens.service');
let processos: Array<EventEmitter & { postMessage: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }>;
let envio: Promise<void>;
let sinalizarEnvio: () => void;
function observarEnvio() { envio = new Promise(resolve => { sinalizarEnvio = resolve; }); }
beforeEach(async () => {
  vi.resetModules(); ambiente.diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-auxiliar-'));
  processos = [];
  observarEnvio();
  ambiente.criar.mockImplementation(() => {
    const processo = Object.assign(new EventEmitter(), { postMessage: vi.fn(() => sinalizarEnvio()), kill: vi.fn() });
    processos.push(processo); return processo;
  });
  ambiente.criar.mockClear();
  servico = await import('../../main/services/processador-imagens.service');
});
afterEach(async () => { servico.encerrarProcessadorImagens(); await rm(ambiente.diretorio, { recursive: true, force: true }); });

it('rejeita resposta inválida, termina o auxiliar e permite nova tentativa', async () => {
  const primeira = servico.processarImagem(entrada);
  const falha = expect(primeira).rejects.toThrow('Resposta inválida');
  await envio;
  processos[0].emit('message', { id: -1, resultado: 'inválido' }); await falha;
  expect(processos[0].kill).toHaveBeenCalledTimes(1);
  observarEnvio();
  const segunda = servico.processarImagem(entrada);
  await envio;
  const mensagem = processos[1].postMessage.mock.calls[0][0];
  processos[1].emit('message', { id: mensagem.id, resultado: { bytes: Buffer.from('derivada'), mimeType: 'image/jpeg' } });
  expect((await segunda).bytes).toEqual(Buffer.from('derivada'));
});

it('rejeita a tarefa quando o auxiliar encerra sem resposta, sem repeti-la', async () => {
  const promessa = servico.processarImagem(entrada);
  const falha = expect(promessa).rejects.toThrow('interrompido');
  await envio;
  processos[0].emit('exit', 1); await falha;
  expect(ambiente.criar).toHaveBeenCalledTimes(1);
});

it('cancela um contexto durante a consulta ao cache sem iniciar o auxiliar', async () => {
  const promessa = servico.comContextoImagens('painel', () => servico.processarImagem(entrada));
  servico.cancelarProcessamentoImagens('painel');
  await expect(promessa).rejects.toThrow('cancelado');
  expect(ambiente.criar).not.toHaveBeenCalled();
});
