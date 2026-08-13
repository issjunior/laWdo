import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagnosticoCapturaService } from '@main/services/diagnostico-captura.service.js';
import { DiagnosticoEventosService } from '@main/services/diagnostico-eventos.service.js';

const diretorios: string[] = [];

async function criarServico() {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-captura-'));
  diretorios.push(diretorio);
  const eventos = new DiagnosticoEventosService(path.join(diretorio, 'eventos.ndjson'));
  const sonda: boolean[] = [];
  const servico = new DiagnosticoCapturaService({
    diretorioSessao: () => diretorio,
    sessionId: () => 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
    eventos: () => eventos,
    capturarLinhaBase: async () => ({ janelaId: 1, rota: '#/laudos', interface: { elementos: [] }, erros: [] }),
    capturarEstadoFinal: async () => ({ interface: { elementos: [] }, erros: [] }),
    alterarSonda: ativa => { sonda.push(ativa); },
  });
  return { servico, eventos, sonda, diretorio };
}

afterEach(async () => {
  await Promise.all(diretorios.splice(0).map(diretorio => rm(diretorio, { recursive: true, force: true })));
});

describe('DiagnosticoCapturaService', () => {
  it('fecha o intervalo da reprodução, preserva artefato e é idempotente', async () => {
    const { servico, eventos, sonda, diretorio } = await criarServico();
    await eventos.registrar({ origem: 'preload', categoria: 'acao', nivel: 'info', dados: { tipo: 'clique_usuario' } });
    const inicio = await servico.iniciar({ finalidade: 'problema', cenario: 'A rolagem salta ao abrir uma seção com imagens.' });
    const capturaId = String(inicio.capturaId);
    await eventos.registrar({ origem: 'preload', categoria: 'acao', nivel: 'debug', dados: { tipo: 'scroll', y: 10, maximoY: 1000 } });
    await eventos.registrar({ origem: 'preload', categoria: 'acao', nivel: 'debug', dados: { tipo: 'scroll', y: 600, maximoY: 1000 } });
    const fim = await servico.finalizar({ capturaId, resultadoUsuario: 'reproduzido' });
    expect(fim).toMatchObject({ classificacao: 'reproduzido', estado: 'finalizada' });
    await expect(servico.finalizar({ capturaId, resultadoUsuario: 'reproduzido' })).resolves.toMatchObject({ caminho: fim.caminho });
    expect(sonda).toEqual([true, false]);
    expect((await readdir(path.join(diretorio, 'capturas')))).toHaveLength(1);
  });

  it('não permite duas capturas ativas na mesma sessão', async () => {
    const { servico } = await criarServico();
    const inicio = await servico.iniciar({ finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'geral' });
    await expect(servico.iniciar({ finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'geral' })).rejects.toThrow('CAPTURA_EM_ANDAMENTO');
    await servico.finalizar({ capturaId: String(inicio.capturaId) });
  });
});
