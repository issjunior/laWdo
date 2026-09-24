import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

let diretorioTemporario = '';

vi.mock('electron', () => ({ app: { getPath: () => diretorioTemporario } }));
vi.mock('@main/services/configuracao.service.js', () => ({
  configuracaoService: { obter: vi.fn(async () => 'importante'), salvar: vi.fn(async () => undefined) },
}));

const { DesempenhoService } = await import('@main/services/desempenho.service.js');

describe('DesempenhoService', () => {
  const servicos: InstanceType<typeof DesempenhoService>[] = [];

  afterEach(async () => {
    await Promise.all(servicos.splice(0).map(servico => servico.encerrar()));
    if (diretorioTemporario) await fs.rm(diretorioTemporario, { recursive: true, force: true });
    diretorioTemporario = '';
  });

  async function criarServico(): Promise<InstanceType<typeof DesempenhoService>> {
    diretorioTemporario = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-desempenho-'));
    const servico = new DesempenhoService();
    servicos.push(servico);
    await servico.inicializar();
    return servico;
  }

  it('filtra eventos informativos funcionais no perfil importante e persiste amostras', async () => {
    const servico = await criarServico();
    await servico.registrar({ origem: 'placeholder', categoria: 'visualizacao', evento: 'aplicado', operacao: 'aplicar_visualizacao' });
    await servico.registrar({ origem: 'processo', categoria: 'amostra', evento: 'metricas_processos', metricas: { cpuPercentual: 12 } });

    const amostras = await servico.listar();

    expect(amostras).toHaveLength(1);
    expect(amostras[0]).toMatchObject({ evento: 'metricas_processos', perfil: 'importante' });
  });

  it('preserva canal e resumo agregado sem aceitar identificadores inseguros', async () => {
    const servico = await criarServico();
    await servico.iniciarDetalhada();
    await servico.registrar({
      origem: 'ipc', categoria: 'canal', evento: 'resumo_ipc', canal: 'laudo:salvar', operacao: 'salvar_laudo',
      resumoIpc: [{ canal: 'laudo:salvar', quantidade: 2, falhas: 0, duracaoMaximaMs: 350, duracaoMediaMs: 210, bytesEntrada: 100, bytesSaida: 20 }],
    });
    await servico.registrar({ origem: 'ipc', categoria: 'canal', evento: 'concluido', canal: '<conteudo-secreto>', operacao: 'html com texto' });

    const amostras = await servico.listar();

    expect(amostras.find(amostra => amostra.evento === 'resumo_ipc')).toMatchObject({ canal: 'laudo:salvar', resumoIpc: [{ canal: 'laudo:salvar', quantidade: 2 }] });
    expect(amostras.find(amostra => amostra.evento === 'concluido')).toMatchObject({ canal: null, operacao: null });
  });

  it('exporta CSV com campos de correlação e protege a fila de eventos informativos', async () => {
    const servico = await criarServico();
    await servico.iniciarDetalhada();
    await servico.registrar({ origem: 'renderer', categoria: 'amostra', evento: 'metricas_renderer' });
    const csv = await servico.exportarCsv();
    const interno = servico as unknown as { fila: Array<{ severidade: string }> };
    interno.fila = Array.from({ length: 1_000 }, () => ({ severidade: 'critico' }));
    await servico.registrar({ origem: 'renderer', categoria: 'amostra', evento: 'metricas_renderer' });

    const estado = await servico.obterEstado();

    expect(estado.eventosDescartados).toBeGreaterThan(0);
    expect(csv).toContain('operacao,canal');
    expect(csv).toContain('metricas_renderer');
  });
});
