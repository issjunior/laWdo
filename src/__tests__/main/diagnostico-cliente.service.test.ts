import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { solicitarDiagnostico } from '@main/services/diagnostico-cliente.service';

const simulacao = vi.hoisted(() => ({ conectar: vi.fn() }));
vi.mock('node:net', () => ({ default: { connect: simulacao.conectar }, connect: simulacao.conectar }));

class SocketSimulado extends EventEmitter {
  pedido = { requestId: '' };
  destroy = vi.fn();
  write(texto: string) { this.pedido = JSON.parse(texto) as { requestId: string }; }
  responder(dados: unknown) { return Buffer.from(`${JSON.stringify({ requestId: this.pedido.requestId, ok: true, dados })}\n`); }
}

let socket: SocketSimulado;
beforeEach(() => { vi.useFakeTimers(); socket = new SocketSimulado(); simulacao.conectar.mockReturnValue(socket); });
afterEach(() => vi.useRealTimers());
function iniciar() {
  const resultado = solicitarDiagnostico('pipe-simulado', 'token-simulado', 'diagnostico_status', {});
  socket.emit('connect');
  return resultado;
}

describe('cliente do pipe diagnóstico', () => {
  it.each([['pequena', 'texto'], ['grande', 'á'.repeat(100_000)]])('aguarda delimitador e preserva UTF-8 fragmentado: %s', async (_nome, texto) => {
    const resultado = iniciar();
    const resposta = socket.responder({ texto });
    const corte = resposta.indexOf(Buffer.from('á')) + 1;
    socket.emit('data', resposta.subarray(0, Math.max(1, corte)));
    socket.emit('data', resposta.subarray(Math.max(1, corte), -1));
    expect(socket.destroy).not.toHaveBeenCalled();
    socket.emit('data', Buffer.from('\n'));
    await expect(resultado).resolves.toMatchObject({ ok: true, dados: { texto } });
    expect(socket.destroy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(socket.listenerCount('data')).toBe(0);
  });

  it.each(['{inválido}\n', '{"requestId":"outro","ok":true,"dados":{}}\n', '{"ok":false}\n'])('rejeita envelope inválido %#', async texto => {
    const resultado = iniciar(); socket.emit('data', Buffer.from(texto));
    await expect(resultado).resolves.toMatchObject({ ok: false, erro: { codigo: 'ERRO_INTERNO' } });
  });
  it.each(['end', 'close'])('rejeita fechamento incompleto por %s', async evento => {
    const resultado = iniciar(); socket.emit('data', Buffer.from('{')); socket.emit(evento);
    await expect(resultado).resolves.toMatchObject({ erro: { codigo: 'ERRO_INTERNO' } });
  });
  it('distingue falha de conexão, timeout e excesso de tamanho', async () => {
    const conexao = solicitarDiagnostico('pipe', 'token', 'status', {});
    socket.emit('error', new Error('sem conexão'));
    await expect(conexao).resolves.toMatchObject({ erro: { codigo: 'SESSAO_INDISPONIVEL' } });
    const prazo = iniciar(); await vi.advanceTimersByTimeAsync(5_000);
    await expect(prazo).resolves.toMatchObject({ erro: { codigo: 'TIMEOUT' } });
    const limite = iniciar(); socket.emit('data', Buffer.alloc(32 * 1024 * 1024 + 1));
    await expect(limite).resolves.toMatchObject({ erro: { codigo: 'ERRO_INTERNO', mensagem: expect.stringContaining('32 MiB') } });
  });
  it('devolve erro explícito quando a criação da conexão falha sincronicamente', async () => {
    simulacao.conectar.mockImplementationOnce(() => { throw new Error('Pipe inválido'); });
    await expect(solicitarDiagnostico('pipe', 'token', 'status', {})).resolves.toMatchObject({ erro: { codigo: 'SESSAO_INDISPONIVEL' } });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('distingue conexão interrompida de envelope negativo válido', async () => {
    const conexao = iniciar(); socket.emit('error', new Error('Conexão interrompida'));
    await expect(conexao).resolves.toMatchObject({ erro: { codigo: 'SESSAO_INDISPONIVEL' } });
    const resposta = iniciar();
    socket.emit('data', Buffer.from(JSON.stringify({ requestId: socket.pedido.requestId, ok: false, erro: { codigo: 'CAPTURA_NAO_ENCONTRADA', mensagem: 'Captura desconhecida.' } }) + '\n'));
    await expect(resposta).resolves.toMatchObject({ erro: { codigo: 'CAPTURA_NAO_ENCONTRADA' } });
  });

});
