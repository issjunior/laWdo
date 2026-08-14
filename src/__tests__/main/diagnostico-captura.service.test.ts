import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
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
    const captura = path.join(diretorio, 'capturas', (await readdir(path.join(diretorio, 'capturas')))[0]!);
    await expect(readFile(path.join(captura, 'contexto-execucao.json'), 'utf8')).resolves.toContain('versaoProtocolo');
    await expect(readFile(path.join(captura, 'marcadores-interface.json'), 'utf8')).resolves.toContain('marcadores');
    await expect(readFile(path.join(captura, 'resumo.md'), 'utf8')).resolves.toContain('Classificação: reproduzido');
  });

  it('não permite duas capturas ativas na mesma sessão', async () => {
    const { servico } = await criarServico();
    const inicio = await servico.iniciar({ finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'geral' });
    await expect(servico.iniciar({ finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'geral' })).rejects.toThrow('CAPTURA_EM_ANDAMENTO');
    await servico.finalizar({ capturaId: String(inicio.capturaId) });
  });

  it('fecha desempenho automaticamente como finalizada quando encerrado pelo prazo', async () => {
    const { servico } = await criarServico();
    const inicio = await servico.iniciar({ finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'geral' });
    const resultado = await servico.finalizar({ capturaId: String(inicio.capturaId) });
    expect(resultado).toMatchObject({ estado: 'finalizada', classificacao: 'concluida' });
  });

  it('limita as amostras de desempenho a 300 mesmo quando há muitos processos', async () => {
    const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-captura-'));
    diretorios.push(diretorio);
    const eventos = new DiagnosticoEventosService(path.join(diretorio, 'eventos.ndjson'));
    const servico = new DiagnosticoCapturaService({
      diretorioSessao: () => diretorio,
      sessionId: () => 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
      eventos: () => eventos,
      capturarLinhaBase: async () => ({ janelaId: 1, rota: '#/laudos', erros: [] }),
      capturarEstadoFinal: async () => ({ erros: [] }),
      obterMetricas: () => Array.from({ length: 301 }, (_, pid) => ({ pid, tipo: 'Tab', cpu: 0, memoriaKb: 1, detalheExterno: 'não deve ser persistido' })),
      alterarSonda: () => undefined,
    });
    const inicio = await servico.iniciar({ finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'geral' });
    await servico.finalizar({ capturaId: String(inicio.capturaId) });
    await expect(servico.consultar({ capturaId: String(inicio.capturaId), componente: 'metricas_resumo', depoisDe: 0, limite: 50 })).resolves.toMatchObject({ amostras: 300, degradacao: { ativa: true, motivo: 'LIMITE_AMOSTRAS' } });
    await expect(servico.consultar({ capturaId: String(inicio.capturaId), componente: 'amostras_processos', depoisDe: 0, limite: 1 })).resolves.toMatchObject({ itens: [{ pid: 0, tipo: 'Tab' }] });
    const amostras = await servico.consultar({ capturaId: String(inicio.capturaId), componente: 'amostras_processos', depoisDe: 0, limite: 1 }) as { itens: Array<Record<string, unknown>> };
    expect(amostras.itens[0]).not.toHaveProperty('detalheExterno');
  });

  it('reduz para o perfil essencial quando a persistência está sob pressão', async () => {
    const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-captura-'));
    diretorios.push(diretorio);
    const eventos = new DiagnosticoEventosService(path.join(diretorio, 'eventos.ndjson'));
    const servico = new DiagnosticoCapturaService({
      diretorioSessao: () => diretorio,
      sessionId: () => 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
      eventos: () => eventos,
      capturarLinhaBase: async () => ({ janelaId: 1, rota: '#/laudos', erros: [] }),
      capturarEstadoFinal: async () => ({ erros: [] }),
      obterMetricas: () => [{ pid: 1, tipo: 'Browser', cpu: 0, memoriaKb: 1 }, { pid: 2, tipo: 'Tab', cpu: 0, memoriaKb: 1 }],
      obterPendenciasPersistencia: () => 20,
      alterarSonda: () => undefined,
    });
    const inicio = await servico.iniciar({ finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'geral' });
    expect(servico.status(String(inicio.capturaId))).toMatchObject({ perfilDesempenho: 'essencial', degradacao: { ativa: true, motivo: 'FILA_PERSISTENCIA' } });
    await servico.finalizar({ capturaId: String(inicio.capturaId) });
  });
});
