import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const simulacao = vi.hoisted(() => ({
  diretorio: `${process.cwd()}/node_modules/.cache/gdl-cache-test-${process.pid}-${Math.random().toString(36).slice(2)}`,
  identidade: vi.fn(), listar: vi.fn(), naturezas: vi.fn(),
}));

vi.mock('electron', () => ({ app: { getPath: () => simulacao.diretorio } }));
vi.mock('../../main/services/gdl.service.js', () => ({
  obterIdentidadeMinhasReps: simulacao.identidade,
  listarMinhasReps: simulacao.listar,
  consultarNaturezasMinhasReps: simulacao.naturezas,
}));

import { atualizarMinhasRepsEmCache, obterMinhasRepsEmCache } from '../../main/services/gdl-minhas-reps-cache.service';

const rep = { idGdl: 11, numero: '123', ano: '2026', naturezaExame: 'EXAME', naturezaExameComCodigo: null,
  status: 'Aberta e Distribuída', dataDesignacao: '2026-10-01T10:00', quantidadeFotos: 2 };

beforeEach(() => {
  simulacao.identidade.mockReset().mockResolvedValue('credencial-a');
  simulacao.listar.mockReset().mockResolvedValue({ reps: [rep], paginaAtual: 1, temAnterior: false, temProxima: false, listagemId: 'lista-1' });
  simulacao.naturezas.mockReset().mockResolvedValue([{ idGdl: 11, naturezaExameComCodigo: 'B601 - EXAME' }]);
});

afterAll(async () => {
  const raiz = path.resolve(process.cwd(), 'node_modules', '.cache');
  const alvo = path.resolve(simulacao.diretorio);
  if (!alvo.startsWith(`${raiz}${path.sep}`)) throw new Error('Diretório temporário fora da área de testes.');
  await rm(alvo, { recursive: true, force: true });
});

describe('cache da listagem GDL', () => {
  it('grava somente a lista completa e reutiliza o resultado por dez minutos', async () => {
    const primeira = await atualizarMinhasRepsEmCache('usuario-a', false);
    expect(primeira.reps[0].naturezaExameComCodigo).toBe('B601 - EXAME');
    expect(await obterMinhasRepsEmCache('usuario-a')).toEqual(primeira);
    expect(await atualizarMinhasRepsEmCache('usuario-a', false)).toEqual(primeira);
    expect(simulacao.listar).toHaveBeenCalledTimes(1);
    await atualizarMinhasRepsEmCache('usuario-a', true);
    expect(simulacao.listar).toHaveBeenCalledTimes(2);
  });

  it('reconsulta ao completar dez minutos desde a última atualização', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
      await atualizarMinhasRepsEmCache('usuario-prazo', false);
      vi.setSystemTime(new Date('2026-10-01T12:09:59.000Z'));
      await atualizarMinhasRepsEmCache('usuario-prazo', false);
      expect(simulacao.listar).toHaveBeenCalledTimes(1);
      vi.setSystemTime(new Date('2026-10-01T12:10:00.000Z'));
      await atualizarMinhasRepsEmCache('usuario-prazo', false);
      expect(simulacao.listar).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('compartilha uma consulta simultânea e separa usuário e credenciais', async () => {
    let liberar: (valor: unknown) => void = () => undefined;
    simulacao.listar.mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; }));
    const uma = atualizarMinhasRepsEmCache('usuario-b', true);
    const duas = atualizarMinhasRepsEmCache('usuario-b', true);
    await vi.waitFor(() => expect(simulacao.listar).toHaveBeenCalledTimes(1));
    liberar({ reps: [rep], paginaAtual: 1, temAnterior: false, temProxima: false, listagemId: 'lista-1' });
    expect(await uma).toEqual(await duas);
    expect(simulacao.listar).toHaveBeenCalledTimes(1);
    expect(await obterMinhasRepsEmCache('usuario-c')).toBeNull();
    simulacao.identidade.mockResolvedValue('credencial-b');
    expect(await obterMinhasRepsEmCache('usuario-b')).toBeNull();
  });

  it('mantém o snapshot anterior quando a paginação ou detalhes falham', async () => {
    const anterior = await atualizarMinhasRepsEmCache('usuario-d', true);
    simulacao.listar.mockResolvedValueOnce({ reps: [rep], paginaAtual: 1, temAnterior: false, temProxima: true, listagemId: 'lista-2' })
      .mockRejectedValueOnce(new Error('VPN indisponível'));
    await expect(atualizarMinhasRepsEmCache('usuario-d', true)).rejects.toThrow('VPN indisponível');
    expect(await obterMinhasRepsEmCache('usuario-d')).toEqual(anterior);
    simulacao.naturezas.mockRejectedValueOnce(new Error('Detalhe indisponível'));
    await expect(atualizarMinhasRepsEmCache('usuario-d', true)).rejects.toThrow('Detalhe indisponível');
    expect(await obterMinhasRepsEmCache('usuario-d')).toEqual(anterior);
  });
});
