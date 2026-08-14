import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import { describe, expect, it } from 'vitest';
import { DiagnosticoPipeService } from '@main/services/diagnostico-pipe.service.js';

const token = 'a'.repeat(64);
const sessao = {
  versaoProtocolo: 1 as const,
  sessionId: 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
  workspaceId: 'b'.repeat(64),
  pipe: '',
  pid: process.pid,
  iniciadoEm: '2026-08-12T12:00:00.000Z',
  token,
};

function enviar(pipe: string, mensagem: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const cliente = connect(pipe);
    let retorno = '';
    cliente.setEncoding('utf8');
    cliente.once('connect', () => cliente.write(`${JSON.stringify(mensagem)}\n`));
    cliente.on('data', dado => {
      retorno += dado;
      if (retorno.includes('\n')) {
        cliente.end();
        resolve(retorno);
      }
    });
    cliente.once('end', () => resolve(retorno));
    cliente.once('error', reject);
  });
}

describe('DiagnosticoPipeService', () => {
  it('aceita apenas token válido e correlaciona a resposta', async () => {
    const pipe = `\\\\.\\pipe\\lawdo-diagnostico-teste-${randomUUID()}`;
    const servico = new DiagnosticoPipeService(
      () => ({ ...sessao, pipe }),
      async mensagem => ({ requestId: mensagem.requestId, ok: true, dados: { operacao: mensagem.operacao } }),
    );
    await servico.iniciar(pipe);
    try {
      const requestId = randomUUID();
      const valido = await enviar(pipe, { token, requestId, operacao: 'diagnostico_status', payload: {} });
      expect(JSON.parse(valido)).toMatchObject({ requestId, ok: true, dados: { operacao: 'diagnostico_status' } });
      await expect(enviar(pipe, { token: 'c'.repeat(64), requestId: randomUUID(), operacao: 'diagnostico_status', payload: {} })).resolves.toBe('');
    } finally {
      await servico.encerrar();
    }
  });
});
