import { appendFile, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticoGpuService, type DependenciasGpu } from '@main/services/diagnostico-gpu.service.js';

const diretorios: string[] = [];
const servicos: DiagnosticoGpuService[] = [];
beforeEach(() => { vi.useFakeTimers(); });
afterEach(async () => {
  for (const servico of servicos.splice(0)) await servico.encerrar();
  vi.useRealTimers();
  await Promise.all(diretorios.splice(0).map(diretorio => rm(diretorio, { recursive: true, force: true })));
});

async function criar(alteracoes: Partial<DependenciasGpu> = {}) {
  const diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-gpu-'));
  diretorios.push(diretorio);
  const arquivoNativo = path.join(diretorio, 'chromium.log');
  await writeFile(arquivoNativo, '');
  let pid = 10;
  const registrar = vi.fn().mockResolvedValue(undefined);
  const consultarWindows = vi.fn().mockResolvedValue({ estado: 'disponivel', eventos: [] });
  const dependencias: DependenciasGpu = { diretorio, arquivoNativo, ambienteExecucao: { electron: 'teste' },
    obterInformacoes: async () => ({ gpuDevice: [{ vendorId: 8086, deviceId: 1, driverVersion: '27.20', segredo: 'oculto' }], auxAttributes: { glRenderer: 'ANGLE Intel', outro: 'oculto' } }),
    obterRecursos: () => ({ gpu_compositing: 'enabled' }),
    obterMetricas: () => [{ pid, type: 'GPU', cpu: { percentCPUUsage: 3 }, memory: { workingSetSize: 100 } }, { pid: 5, type: 'Tab', cpu: { percentCPUUsage: 1 }, memory: { workingSetSize: 200 } }],
    obterContexto: () => ({ rota: '/projeteis', zoom: 1 }), registrar, consultarWindows, ...alteracoes };
  const servico = new DiagnosticoGpuService(dependencias);
  servicos.push(servico);
  return { servico, dependencias, diretorio, arquivoNativo, registrar, consultarWindows, alterarPid: (valor: number) => { pid = valor; } };
}
const consulta = (incidenteId: string | null, componente: 'incidente' | 'ambiente' | 'logs_nativos' | 'eventos_windows' = 'incidente') => ({ incidenteId: incidenteId ?? undefined, componente, depoisDe: 0, limite: 50 });

describe('coleta automática de GPU', () => {
  it('persiste saída 34 sem captura guiada e confirma recuperação somente com novo PID', async () => {
    const { servico, alterarPid, diretorio, registrar } = await criar();
    await servico.atualizarAmbiente(); servico.coletarAmostra();
    const id = await servico.registrarFalha('abnormal-exit', 34);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ evento: 'gpu_encerrada', codigo: 34, classificacao: 'contexto_grafico_perdido' }), id);
    servico.coletarAmostra();
    expect(servico.consultar(consulta(id))).toMatchObject({ ocorrencias: [{ pidAnterior: 10, recuperacao: 'aguardando' }] });
    alterarPid(20); servico.coletarAmostra(); await servico.encerrar();
    expect(servico.consultar(consulta(id))).toMatchObject({ ocorrencias: [{ recuperacao: 'confirmada', novoPid: 20 }], contexto: { rota: '/projeteis' } });
    const valor: unknown = JSON.parse(await readFile(path.join(diretorio, 'gpu', 'incidentes', `${id}.json`), 'utf8'));
    expect(valor).toMatchObject({ ambienteAnterior: { dados: { adaptadores: [{ driverVersion: '27.20' }] } } });
    expect(JSON.stringify(valor)).not.toContain('oculto');
    expect(await readdir(path.join(diretorio, 'gpu', 'incidentes'))).toEqual([`${id}.json`]);
  });

  it('preserva outros códigos sem classificar todos como perda de contexto', async () => {
    const { servico } = await criar();
    const id = await servico.registrarFalha('oom', 9);
    expect(servico.consultar(consulta(id))).toMatchObject({ ocorrencias: [{ codigo: 9, motivo: 'oom', classificacao: 'processo_gpu_encerrado' }], idadeAmbienteMs: null, lacunas: ['AMBIENTE_ANTERIOR_AUSENTE'] });
  });

  it('acompanha reinícios repetidos no mesmo incidente e preserva cada código', async () => {
    const { servico, alterarPid } = await criar();
    servico.coletarAmostra();
    const id = await servico.registrarFalha('abnormal-exit', 34);
    alterarPid(20); servico.coletarAmostra();
    expect(await servico.registrarFalha('crashed', 1)).toBe(id);
    alterarPid(30); servico.coletarAmostra();
    expect(servico.consultar(consulta(id))).toMatchObject({ ocorrencias: [
      { codigo: 34, pidAnterior: 10, novoPid: 20, recuperacao: 'confirmada' },
      { codigo: 1, pidAnterior: 20, novoPid: 30, recuperacao: 'confirmada' },
    ] });
  });

  it('limita a memória mesmo quando o disco falha e respeita o orçamento em bytes', async () => {
    let agora = Date.now();
    const { servico, diretorio } = await criar({ agora: () => agora, limites: { incidentes: 2 } });
    await writeFile(path.join(diretorio, 'gpu'), 'bloqueio de escrita');
    for (let indice = 0; indice < 5; indice += 1) { await servico.registrarFalha('crashed', 1); agora += 60_000; }
    expect(servico.resumo().totalIncidentes).toBe(2);
    const limitado = await criar({ limites: { bytesIncidentes: 1 } });
    await limitado.servico.registrarFalha('crashed', 1);
    expect(limitado.servico.resumo().totalIncidentes).toBe(0);
    expect(await readdir(path.join(limitado.diretorio, 'gpu', 'incidentes'))).toEqual([]);
  });

  it('explicita timeout do ambiente sem deixar temporizador pendente', async () => {
    const { servico } = await criar({ obterInformacoes: () => new Promise(() => undefined) });
    const atualizacao = servico.atualizarAmbiente();
    await vi.advanceTimersByTimeAsync(3000);
    await atualizacao;
    expect(servico.resumo().lacunas).toContain('AMBIENTE_GPU_INDISPONIVEL');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('agrupa apenas dentro dos 60 segundos contados desde a primeira ocorrência', async () => {
    let agora = Date.now();
    const { servico } = await criar({ agora: () => agora });
    const primeiro = await servico.registrarFalha('crashed', 1);
    agora += 59_000;
    expect(await servico.registrarFalha('abnormal-exit', 34)).toBe(primeiro);
    agora += 1_000;
    expect(await servico.registrarFalha('crashed', 2)).not.toBe(primeiro);
    expect(servico.consultar(consulta(primeiro))).toMatchObject({ totalOcorrencias: 2, ocorrencias: [{ codigo: 1 }, { codigo: 34 }] });
  });

  it('marca recuperação inconclusiva após 15 segundos e consulta Windows em 15 e 60 segundos', async () => {
    const { servico, consultarWindows } = await criar();
    servico.coletarAmostra();
    const id = await servico.registrarFalha('abnormal-exit', 34);
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.waitFor(() => expect(consultarWindows).toHaveBeenCalledTimes(1));
    expect(servico.consultar(consulta(id))).toMatchObject({ ocorrencias: [{ recuperacao: 'inconclusiva' }] });
    await vi.advanceTimersByTimeAsync(45_000);
    await vi.waitFor(() => expect(consultarWindows).toHaveBeenCalledTimes(2));
  });

  it('preserva logs sanitizados e continua lendo depois de truncar o arquivo nativo', async () => {
    const { servico, arquivoNativo } = await criar({ limites: { bytesNativo: 10 } });
    await appendFile(arquivoNativo, '[gpu_service_impl.cc] token=segredo https://local/privado C:\\Users\\Jr\\privado\n');
    await servico.lerLogNativo();
    expect((await stat(arquivoNativo)).size).toBe(0);
    await appendFile(arquivoNativo, '[gpu_process_host.cc] exit_code=34\n');
    await servico.lerLogNativo();
    const id = await servico.registrarFalha('crashed', 34);
    const resultado = servico.consultar(consulta(id, 'logs_nativos'));
    expect(JSON.stringify(resultado)).toContain('exit_code=34');
    expect(JSON.stringify(resultado)).not.toContain('segredo');
    expect(JSON.stringify(resultado)).not.toContain('privado');
    expect(resultado).toMatchObject({ total: 2, lacunas: expect.arrayContaining(['LOG_NATIVO_LIMITE_EXCEDIDO_CONTINUIDADE_PARCIAL']) });
    expect(servico.consultar({ ...consulta(id, 'logs_nativos'), limite: 1 })).toMatchObject({ proximoCursor: 1, total: 2, registros: [expect.any(Object)] });
  });

  it('registra falhas de consulta e persistência sem rejeitar o evento da aplicação', async () => {
    const { servico, diretorio } = await criar({ registrar: async () => { throw new Error('falha'); }, consultarWindows: async () => { throw new Error('negado'); } });
    await writeFile(path.join(diretorio, 'gpu'), 'diretório indisponível');
    const id = await servico.registrarFalha('crashed', 34);
    await vi.advanceTimersByTimeAsync(15_000);
    await servico.encerrar();
    expect(servico.resumo().lacunas).toContain('DOSSIE_GPU_FALHA_ESCRITA');
    expect(servico.consultar(consulta(id))).toMatchObject({ lacunas: expect.arrayContaining(['EVENTO_GPU_NAO_PERSISTIDO', 'WINDOWS_INDISPONIVEL']) });
  });

  it('aplica retenção e não aceita IDs como caminhos de arquivo', async () => {
    let agora = Date.now();
    const { servico, diretorio } = await criar({ limites: { incidentes: 1 }, agora: () => agora });
    const primeiro = await servico.registrarFalha('crashed', 1); agora += 60_000;
    const segundo = await servico.registrarFalha('crashed', 2);
    expect(servico.resumo().totalIncidentes).toBe(1);
    expect(() => servico.consultar(consulta(primeiro))).toThrow('INCIDENTE_GPU_NAO_ENCONTRADO');
    expect(() => servico.consultar(consulta('../../arquivo'))).toThrow('INCIDENTE_GPU_NAO_ENCONTRADO');
    expect(await readdir(path.join(diretorio, 'gpu', 'incidentes'))).toEqual([`${segundo}.json`]);
  });

  it('mantém somente 120 segundos de métricas e encerra todos os temporizadores', async () => {
    const { servico } = await criar();
    servico.iniciar();
    await vi.advanceTimersByTimeAsync(130_000);
    const id = await servico.registrarFalha('crashed', 34);
    const resultado = servico.consultar(consulta(id));
    expect(resultado.amostras).toEqual(expect.any(Array));
    expect((resultado.amostras as unknown[]).length).toBeLessThanOrEqual(61);
    await servico.encerrar();
    expect(vi.getTimerCount()).toBe(0);
    expect(servico.resumo().ativo).toBe(false);
    expect(await servico.registrarFalha('crashed', 34)).toBeNull();
  });

  it('sinaliza GPU e log indisponíveis sem fabricar informações', async () => {
    const { servico, arquivoNativo } = await criar({ obterInformacoes: async () => { throw new Error('indisponível'); } });
    await rm(arquivoNativo);
    await servico.atualizarAmbiente(); await servico.lerLogNativo();
    expect(servico.resumo()).toMatchObject({ ambiente: null, logNativo: { ativo: false }, lacunas: expect.arrayContaining(['AMBIENTE_GPU_INDISPONIVEL', 'LOG_NATIVO_INDISPONIVEL']) });
  });
});
