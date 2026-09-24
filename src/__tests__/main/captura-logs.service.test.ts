import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

let diretorioTemporario = '';

vi.mock('electron', () => ({ app: { getPath: () => diretorioTemporario } }));

const { CapturaLogsService } = await import('@main/services/captura-logs.service.js');

describe('CapturaLogsService', () => {
  const servicos: InstanceType<typeof CapturaLogsService>[] = [];

  afterEach(async () => {
    await Promise.all(servicos.splice(0).map(servico => servico.encerrar()));
    if (diretorioTemporario) await fs.rm(diretorioTemporario, { recursive: true, force: true });
    diretorioTemporario = '';
  });

  async function criarServico(): Promise<InstanceType<typeof CapturaLogsService>> {
    diretorioTemporario = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-captura-logs-'));
    const servico = new CapturaLogsService();
    servicos.push(servico);
    await servico.inicializar();
    return servico;
  }

  it('mantém uma única captura, preserva a parada manual e anonimiza a linha do tempo', async () => {
    const servico = await criarServico();
    const estado = await servico.iniciar(['auditoria', 'linha_tempo']);
    const id = estado.ativa?.id;

    expect(Date.parse(estado.ativa!.terminaEm) - Date.parse(estado.ativa!.iniciadaEm)).toBe(5 * 60_000);
    await expect(servico.iniciar(['sistema'])).rejects.toThrow('CAPTURA_ATIVA');
    await servico.registrarAuditoria({ modulo: 'rep', tipoAcao: 'atualizacao', entidade: 'reps', entidadeId: 'rep-secreta-123' });
    await servico.marcarProblema();
    await servico.parar();

    expect(id).toBeTruthy();
    const captura = await servico.ler(id!);
    expect(captura).toMatchObject({ versaoFormato: 2, motivoEncerramento: 'manual', sondas: ['auditoria', 'linha_tempo'], qualidade: 'suficiente' });
    expect(captura?.eventos.some(evento => evento.codigo === 'problema_aconteceu_agora')).toBe(true);
    expect(captura?.resumo.marcadores.some(marcador => marcador.codigo === 'problema_aconteceu_agora')).toBe(true);
    expect(captura?.coberturaSondas.every(sonda => sonda.possuiEvidencia)).toBe(true);
    expect(JSON.stringify(captura)).not.toContain('rep-secreta-123');
    expect(captura?.eventos.some(evento => evento.sonda === 'linha_tempo' && typeof evento.dados.contexto === 'string')).toBe(true);
  });

  it('consolida métricas e achados para erros e desempenho', async () => {
    const servico = await criarServico();
    const estado = await servico.iniciar(['sistema', 'desempenho']);
    await servico.registrarSistema('error', 'laudo');
    await servico.registrarSistema('error', 'laudo');
    await servico.registrarDesempenho({ origem: 'renderer', categoria: 'editor', evento: 'aplicado', operacao: 'aplicar_visualizacao', duracaoMs: 2_100, contextoId: 'identificador-real', metricas: { atrasoEventLoopMs: 250, longTasks: 3, memoriaKb: 400_000 } });
    await servico.registrarDesempenho({ origem: 'processo', categoria: 'amostra', evento: 'metricas_processos', metricas: { memoriaKb: 470_000 } });
    await servico.registrarDesempenho({ origem: 'processo', categoria: 'amostra', evento: 'metricas_processos', metricas: { memoriaKb: 500_000 } });
    await servico.parar();

    const captura = await servico.ler(estado.ativa!.id);
    expect(captura?.resumo.metricas.some(metrica => metrica.metrica === 'memoriaKb')).toBe(true);
    expect(captura?.resumo.achados.map(achado => achado.tipo)).toEqual(expect.arrayContaining(['erros_repetidos', 'operacao_lenta', 'atraso_event_loop', 'long_tasks', 'memoria_crescente']));
    expect(JSON.stringify(captura)).not.toContain('identificador-real');
  });

  it('preserva um pico lento mesmo quando o P95 do grupo é baixo', async () => {
    const servico = await criarServico();
    const estado = await servico.iniciar(['desempenho']);
    await Promise.all(Array.from({ length: 20 }, async (_, indice) => {
      await servico.registrarDesempenho({ origem: 'renderer', categoria: 'editor', evento: 'concluido', duracaoMs: indice === 19 ? 1_540 : 10 });
    }));
    await servico.parar();

    const captura = await servico.ler(estado.ativa!.id);
    const achado = captura?.resumo.achados.find(item => item.tipo === 'operacao_lenta');
    expect(achado).toMatchObject({ codigo: 'concluido', dados: { duracaoMaximaMs: 1_540, limiarMs: 250 } });
  });

  it('finaliza como interrompida a captura recuperada na inicialização seguinte', async () => {
    const primeiro = await criarServico();
    const estado = await primeiro.iniciar(['sistema']);
    const id = estado.ativa?.id;
    await primeiro.registrarSistema('error', 'laudo');

    const recuperado = new CapturaLogsService();
    servicos.push(recuperado);
    await recuperado.inicializar();

    const captura = await recuperado.ler(id!);
    expect(captura?.motivoEncerramento).toBe('interrompida');
    expect(recuperado.obterEstado().ativa).toBeNull();
  });

  it('retém somente as dez capturas concluídas mais recentes e permite limpeza manual', async () => {
    const servico = await criarServico();
    const diretorio = path.join(diretorioTemporario, 'capturas-logs');
    await Promise.all(Array.from({ length: 11 }, async (_, indice) => {
      const id = `00000000-0000-4000-8000-${String(indice).padStart(12, '0')}`;
      await fs.writeFile(path.join(diretorio, `${id}.json`), JSON.stringify({ versaoFormato: 1, id, sondas: ['sistema'], iniciadaEm: new Date(indice).toISOString(), finalizadaEm: new Date(indice).toISOString(), motivoEncerramento: 'manual', quantidadeEventos: 0, eventosDescartados: 0, qualidade: 'suficiente', eventos: [] }), 'utf8');
    }));
    const arquivoExcedente = path.join(diretorio, 'ffffffff-ffff-4fff-8fff-ffffffffffff.json');
    await fs.writeFile(arquivoExcedente, Buffer.alloc(51 * 1024 * 1024));

    await (servico as unknown as { aplicarRetencao: () => Promise<void> }).aplicarRetencao();
    expect((await servico.listar()).length).toBeLessThanOrEqual(10);
    await expect(fs.stat(arquivoExcedente)).rejects.toThrow();
    await servico.limpar();
    expect(await servico.listar()).toHaveLength(0);
  });
});
