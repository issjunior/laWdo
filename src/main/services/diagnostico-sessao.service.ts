import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { z } from 'zod';
import { limparSessoesDiagnostico, DiagnosticoEventosService } from './diagnostico-eventos.service.js';

const executarArquivo = promisify(execFile);

const schemaSessaoAtiva = z.strictObject({
  versaoProtocolo: z.literal(1),
  sessionId: z.string().uuid(),
  workspaceId: z.string().regex(/^[a-f0-9]{64}$/),
  pipe: z.string().min(1),
  pid: z.number().int().positive(),
  iniciadoEm: z.string().datetime({ offset: true }),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});

export type SessaoDiagnosticoAtiva = z.infer<typeof schemaSessaoAtiva>;

interface DependenciasSessaoDiagnostico {
  obterCaminhoWorkspace: () => string;
  empacotado: () => boolean;
  ambiente: NodeJS.ProcessEnv;
  plataforma: NodeJS.Platform;
  pid: number;
  protegerArquivoWindows?: (caminho: string) => Promise<void>;
}

export function modoDiagnosticoHabilitado(empacotado: boolean, ambiente: NodeJS.ProcessEnv): boolean {
  return !empacotado && ambiente.LAWDO_MODO_DIAGNOSTICO === '1';
}

export function criarNomePipeDiagnostico(workspaceId: string, plataforma: NodeJS.Platform, diretorioRaiz: string): string {
  const sufixo = workspaceId.slice(0, 24);
  return plataforma === 'win32'
    ? `\\\\.\\pipe\\lawdo-diagnostico-${sufixo}`
    : path.posix.join(diretorioRaiz.replace(/\\/g, '/'), `lawdo-diagnostico-${sufixo}.sock`);
}

async function protegerArquivoWindows(caminho: string): Promise<void> {
  const usuario = os.userInfo().username;
  await executarArquivo('icacls', [caminho, '/inheritance:r', '/grant:r', `${usuario}:(R,W)`], { windowsHide: true });
}

function processoAtivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class DiagnosticoSessaoService {
  private readonly dependencias: DependenciasSessaoDiagnostico;
  private sessao: SessaoDiagnosticoAtiva | null = null;
  private eventos: DiagnosticoEventosService | null = null;
  private caminhoRaiz = '';
  private caminhoSessaoAtiva = '';
  private caminhoSessao = '';

  constructor(dependencias: DependenciasSessaoDiagnostico) {
    this.dependencias = dependencias;
  }

  get ativa(): SessaoDiagnosticoAtiva | null {
    return this.sessao;
  }

  get servicoEventos(): DiagnosticoEventosService | null {
    return this.eventos;
  }

  get diretorioSessao(): string | null {
    return this.caminhoSessao || null;
  }

  async iniciar(): Promise<SessaoDiagnosticoAtiva | null> {
    if (!modoDiagnosticoHabilitado(this.dependencias.empacotado(), this.dependencias.ambiente)) return null;
    const workspace = await realpath(this.dependencias.obterCaminhoWorkspace());
    const workspaceId = createHash('sha256').update(workspace).digest('hex');
    this.caminhoRaiz = path.join(workspace, 'tmp', 'diagnostico-agente');
    this.caminhoSessaoAtiva = path.join(this.caminhoRaiz, 'sessao-ativa.json');
    const caminhoSessoes = path.join(this.caminhoRaiz, 'sessoes');
    await mkdir(caminhoSessoes, { recursive: true });
    await this.removerSessaoAbandonada();
    await limparSessoesDiagnostico(caminhoSessoes, null);

    const sessionId = randomUUID();
    const iniciadoEm = new Date().toISOString();
    const caminhoSessao = path.join(caminhoSessoes, `${iniciadoEm.replace(/[:.]/g, '-')}-${sessionId}`);
    await mkdir(path.join(caminhoSessao, 'snapshots'), { recursive: true });
    const sessao = schemaSessaoAtiva.parse({
      versaoProtocolo: 1,
      sessionId,
      workspaceId,
      pipe: criarNomePipeDiagnostico(workspaceId, this.dependencias.plataforma, this.caminhoRaiz),
      pid: this.dependencias.pid,
      iniciadoEm,
      token: randomBytes(32).toString('hex'),
    });
    await writeFile(path.join(caminhoSessao, 'metadados.json'), JSON.stringify({ ...sessao, token: '[redigido]' }, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await writeFile(this.caminhoSessaoAtiva, JSON.stringify(sessao), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    if (this.dependencias.plataforma === 'win32') {
      await (this.dependencias.protegerArquivoWindows ?? protegerArquivoWindows)(this.caminhoSessaoAtiva).catch(async erro => {
        await unlink(this.caminhoSessaoAtiva).catch(() => undefined);
        throw new Error('Não foi possível restringir a credencial diagnóstica ao usuário atual.', { cause: erro });
      });
    }
    this.sessao = sessao;
    this.caminhoSessao = caminhoSessao;
    this.eventos = new DiagnosticoEventosService(path.join(caminhoSessao, 'eventos.ndjson'));
    await this.eventos.registrar({ origem: 'main', categoria: 'sessao', nivel: 'info', dados: { evento: 'iniciada' } });
    return sessao;
  }

  async encerrar(): Promise<void> {
    if (!this.sessao) return;
    try {
      await this.eventos?.registrar({ origem: 'main', categoria: 'sessao', nivel: 'info', dados: { evento: 'encerrada' } });
    } finally {
      try {
        const ativa = schemaSessaoAtiva.parse(JSON.parse(await readFile(this.caminhoSessaoAtiva, 'utf8')));
        if (ativa.sessionId === this.sessao.sessionId) await unlink(this.caminhoSessaoAtiva);
      } catch {
        await rm(this.caminhoSessaoAtiva, { force: true });
      }
      await limparSessoesDiagnostico(path.join(this.caminhoRaiz, 'sessoes'), this.sessao.sessionId);
      this.sessao = null;
      this.eventos = null;
      this.caminhoSessao = '';
    }
  }

  private async removerSessaoAbandonada(): Promise<void> {
    try {
      const existente = schemaSessaoAtiva.safeParse(JSON.parse(await readFile(this.caminhoSessaoAtiva, 'utf8')));
      if (existente.success && processoAtivo(existente.data.pid)) {
        throw new Error('Já existe uma sessão diagnóstica ativa neste workspace.');
      }
      await rm(this.caminhoSessaoAtiva, { force: true });
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return;
      if (erro instanceof Error && erro.message.includes('Já existe')) throw erro;
      await rm(this.caminhoSessaoAtiva, { force: true });
    }
  }
}
