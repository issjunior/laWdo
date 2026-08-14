import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagnosticoEventosService, sanitizarDadosDiagnostico } from '@main/services/diagnostico-eventos.service.js';

const diretorios: string[] = [];

async function criarCaminhoEventos(): Promise<string> {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-diagnostico-'));
  diretorios.push(diretorio);
  return path.join(diretorio, 'eventos.ndjson');
}

afterEach(async () => {
  await Promise.all(diretorios.splice(0).map(async diretorio => {
    const { rm } = await import('node:fs/promises');
    await rm(diretorio, { recursive: true, force: true });
  }));
});

describe('DiagnosticoEventosService', () => {
  it('persiste cada evento em NDJSON e consulta pelo cursor', async () => {
    const caminho = await criarCaminhoEventos();
    const servico = new DiagnosticoEventosService(caminho);
    await servico.registrar({ origem: 'main', categoria: 'sessao', nivel: 'info', dados: { token: 'segredo' } });
    await servico.registrar({ origem: 'preload', categoria: 'ipc', nivel: 'error', dados: { canal: 'laudo:salvar' } });

    expect(servico.consultar({ depoisDe: 0, limite: 1 }).eventos).toHaveLength(1);
    expect(servico.consultar({ depoisDe: 0, limite: 10, niveis: ['error'] }).eventos[0]?.sequencia).toBe(2);
    const primeiraLinha = (await readFile(caminho, 'utf8')).split('\n')[0];
    expect(JSON.parse(primeiraLinha).dados.token).toBe('[redigido]');
  });

  it('tolera a última linha NDJSON incompleta', async () => {
    const caminho = await criarCaminhoEventos();
    await writeFile(caminho, `${JSON.stringify({ sequencia: 1, timestamp: '2026-08-12T12:00:00.000Z', origem: 'main', categoria: 'sessao', nivel: 'info', dados: {} })}\n{`, 'utf8');
    await expect(DiagnosticoEventosService.lerNdjson(caminho)).resolves.toHaveLength(1);
  });

  it('redige dados sensíveis e limita estruturas externas', () => {
    expect(sanitizarDadosDiagnostico({ senha: 'x', value: 'conteúdo do laudo', textContent: 'conteúdo', ausente: 'undefined', dados: ['ok'] })).toEqual({ senha: '[redigido]', value: '[redigido]', textContent: '[redigido]', ausente: null, dados: ['ok'] });
  });
});
