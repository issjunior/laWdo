import { mkdtemp, readdir, readFile, rm, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticoCapturaService } from '@main/services/diagnostico-captura.service.js';
import { DiagnosticoEventosService } from '@main/services/diagnostico-eventos.service.js';

const diretorios: string[] = [];

async function criarServico(obterGpu?: () => Record<string, unknown>, renomearDiretorio?: typeof rename) {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-captura-'));
  diretorios.push(diretorio);
  const eventos = new DiagnosticoEventosService(path.join(diretorio, 'eventos.ndjson'));
  const sonda: boolean[] = [];
  const servico = new DiagnosticoCapturaService({
    diretorioSessao: () => diretorio,
    sessionId: () => 'f0d43c3b-5ff8-4e40-bef2-09444f6693ca',
    eventos: () => eventos,
    obterGpu,
    renomearDiretorio,
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
  it('repete renomeação bloqueada temporariamente e compartilha finalizações concorrentes', async () => {
    const renomear = vi.fn(rename).mockRejectedValueOnce(Object.assign(new Error('Arquivo ocupado'), { code: 'EPERM' }));
    const { servico } = await criarServico(undefined, renomear);
    const inicio = await servico.iniciar({ finalidade: 'problema', cenario: 'Falha transitória de gravação.', capturarConsultasGdl: false });
    const entrada = { capturaId: String(inicio.capturaId) };
    const [primeira, segunda] = await Promise.all([servico.finalizar(entrada), servico.finalizar(entrada)]);
    expect(primeira.caminho).toBe(segunda.caminho);
    expect(renomear).toHaveBeenCalledTimes(2);
    await expect(servico.consultar({ ...entrada, componente: 'manifesto', depoisDe: 0, limite: 50 })).resolves.toMatchObject({ estado: 'finalizada' });
  });

  it('preserva arquivos parciais e permite nova captura após falha persistente', async () => {
    const renomear = vi.fn(rename);
    const { servico, diretorio } = await criarServico(undefined, renomear);
    const inicio = await servico.iniciar({ finalidade: 'problema', cenario: 'Falha persistente de gravação.', capturarConsultasGdl: false });
    for (let indice = 0; indice < 3; indice++) renomear.mockRejectedValueOnce(Object.assign(new Error('Acesso negado'), { code: 'EPERM' }));
    await expect(servico.finalizar({ capturaId: String(inicio.capturaId) })).rejects.toThrow('Acesso negado');
    const pastas = await readdir(path.join(diretorio, 'capturas'));
    expect(pastas.some(nome => nome.endsWith('.tmp'))).toBe(true);
    const proxima = await servico.iniciar({ finalidade: 'problema', cenario: 'Captura após falha.', capturarConsultasGdl: false });
    await expect(servico.finalizar({ capturaId: String(proxima.capturaId) })).resolves.toHaveProperty('caminho');
  });
  it('preserva a captura durante falha gráfica e inclui contexto próprio no dossiê', async () => {
    const { servico, eventos } = await criarServico(() => ({ ativo: true, ultimoIncidenteId: 'gpu-simulada' }));
    const inicio = await servico.iniciar({ finalidade: 'problema', cenario: 'Reproduzir encerramento da GPU.', capturarConsultasGdl: false });
    const capturaId = String(inicio.capturaId);
    await eventos.registrar({ origem: 'main', categoria: 'erro', nivel: 'error', dados: { evento: 'gpu_encerrada', codigo: 34 } });
    expect(servico.status(capturaId)).toMatchObject({ estado: 'coletando' });
    await servico.finalizar({ capturaId, resultadoUsuario: 'reproduzido' });
    await expect(servico.consultar({ capturaId, componente: 'gpu', depoisDe: 0, limite: 50 })).resolves.toMatchObject({ ativo: true, ultimoIncidenteId: 'gpu-simulada' });
    await expect(servico.consultar({ capturaId, componente: 'dossie', depoisDe: 0, limite: 50 })).resolves.toMatchObject({ classesCausa: ['falha_grafica'] });
  });
  it('fecha o intervalo da reprodução, preserva artefato e é idempotente', async () => {
    const { servico, eventos, sonda, diretorio } = await criarServico();
    await eventos.registrar({ origem: 'preload', categoria: 'acao', nivel: 'info', dados: { tipo: 'clique_usuario' } });
    const inicio = await servico.iniciar({ finalidade: 'problema', cenario: 'A rolagem salta ao abrir uma seção com imagens.', capturarConsultasGdl: false });
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


it('coleta GDL somente na janela optante e encerra antes de finalizar', async () => {
  const { servico } = await criarServico();
  const inicio = await servico.iniciar({ finalidade: 'problema', cenario: 'Consultar a REP simulada com campos ausentes.', capturarConsultasGdl: true });
  expect(servico.obterCapturaGdl(1)).toMatchObject({ capturaId: inicio.capturaId });
  expect(servico.obterCapturaGdl(2)).toBeNull();
  const finalizando = servico.finalizar({ capturaId: String(inicio.capturaId) });
  expect(servico.obterCapturaGdl(1)).toBeNull();
  await finalizando;
  const segunda = await servico.iniciar({ finalidade: 'problema', cenario: 'Consultar outra REP sem ativar a coleta.', capturarConsultasGdl: false });
  expect(servico.obterCapturaGdl(1)).toBeNull();
  await servico.finalizar({ capturaId: String(segunda.capturaId) });
});

it.each([['rede', 'conectividade'], ['tempo_esgotado', 'conectividade'], ['autenticacao', 'autenticacao'], ['servidor', 'integracao_gdl']])('distingue falha %s de gargalo de desempenho', async (codigo, classe) => {
  const { servico, eventos } = await criarServico();
  const inicio = await servico.iniciar({ finalidade: 'desempenho', duracaoSegundos: 30, cenarioDesempenho: 'geral' });
  await eventos.registrar({ origem: 'preload', categoria: 'ipc', nivel: 'error', dados: {
    canal: 'gdl:atualizar-minhas-reps-cache', duracaoMs: 2000, resultadoFuncional: 'falha',
    falha: { codigo, etapa: 'carregar_formulario' },
  } });
  await servico.finalizar({ capturaId: String(inicio.capturaId) });
  const dossie = await servico.consultar({ capturaId: String(inicio.capturaId), componente: 'dossie', depoisDe: 0, limite: 50 });
  expect(dossie).toMatchObject({ classesCausa: [classe], anomalias: expect.arrayContaining([expect.objectContaining({ codigo, duracaoMs: 2000 })]) });
  const metricas = await servico.consultar({ capturaId: String(inicio.capturaId), componente: 'metricas_resumo', depoisDe: 0, limite: 50 });
  expect(metricas).toMatchObject({ ipcsLentos: [{ canal: 'gdl:atualizar-minhas-reps-cache', ocorrencias: 1, duracaoP95Ms: 2000 }] });
});
