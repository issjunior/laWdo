import { createServer, type Server, type Socket } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { z } from 'zod';
import type { SessaoDiagnosticoAtiva } from './diagnostico-sessao.service.js';

const schemaMensagemPipe = z.strictObject({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: z.string().uuid(),
  operacao: z.string().min(1).max(100),
  payload: z.unknown(),
});

export type MensagemPipeDiagnostico = z.infer<typeof schemaMensagemPipe>;

export interface RespostaPipeDiagnostico {
  requestId: string;
  ok: boolean;
  dados?: unknown;
  erro?: { codigo: string; mensagem: string };
}

export type ManipuladorPipeDiagnostico = (mensagem: Omit<MensagemPipeDiagnostico, 'token'>) => Promise<RespostaPipeDiagnostico>;

function tokensIguais(recebido: string, esperado: string): boolean {
  const esquerdo = Buffer.from(recebido, 'utf8');
  const direito = Buffer.from(esperado, 'utf8');
  return esquerdo.length === direito.length && timingSafeEqual(esquerdo, direito);
}

export class DiagnosticoPipeService {
  private servidor: Server | null = null;

  constructor(
    private readonly obterSessao: () => SessaoDiagnosticoAtiva | null,
    private readonly manipular: ManipuladorPipeDiagnostico,
  ) {}

  async iniciar(pipe: string): Promise<void> {
    if (this.servidor) throw new Error('O pipe diagnóstico já está iniciado.');
    if (process.platform !== 'win32') await rm(pipe, { force: true }).catch(() => undefined);
    this.servidor = createServer(socket => this.processarConexao(socket));
    await new Promise<void>((resolve, reject) => {
      this.servidor?.once('error', reject);
      this.servidor?.listen(pipe, () => {
        this.servidor?.off('error', reject);
        resolve();
      });
    });
  }

  async encerrar(): Promise<void> {
    const servidor = this.servidor;
    this.servidor = null;
    if (!servidor) return;
    await new Promise<void>((resolve, reject) => servidor.close(erro => erro ? reject(erro) : resolve()));
  }

  private processarConexao(socket: Socket): void {
    let pendente = '';
    socket.setEncoding('utf8');
    socket.on('data', conteudo => {
      pendente += conteudo;
      const linhas = pendente.split('\n');
      pendente = linhas.pop() ?? '';
      for (const linha of linhas) void this.processarLinha(socket, linha);
    });
    socket.on('error', () => undefined);
  }

  private async processarLinha(socket: Socket, linha: string): Promise<void> {
    let mensagem: MensagemPipeDiagnostico;
    try {
      mensagem = schemaMensagemPipe.parse(JSON.parse(linha));
    } catch {
      socket.end();
      return;
    }
    const sessao = this.obterSessao();
    if (!sessao || !tokensIguais(mensagem.token, sessao.token)) {
      socket.end();
      return;
    }
    try {
      const resposta = await this.manipular({ requestId: mensagem.requestId, operacao: mensagem.operacao, payload: mensagem.payload });
      socket.write(`${JSON.stringify(resposta)}\n`);
    } catch {
      socket.write(`${JSON.stringify({ requestId: mensagem.requestId, ok: false, erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falha ao processar a solicitação diagnóstica.' } satisfies RespostaPipeDiagnostico['erro'] })}\n`);
    }
  }
}
