import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtividadeGdlService } from '../../main/services/gdl-atividade.service';

let atividade: AtividadeGdlService;
beforeEach(() => {
  vi.useFakeTimers();
  atividade = new AtividadeGdlService();
});
afterEach(() => vi.useRealTimers());

describe('prioridade de consultas ao GDL', () => {
  it('termina a requisição enviada e pausa antes da próxima até quinze segundos de ociosidade', async () => {
    const requisicao = vi.fn();
    let liberarPrimeira: () => void = () => undefined;
    const automatica = atividade.automatizar(new AbortController().signal, async () => undefined, async () => {
      await atividade.antesDaRequisicao();
      requisicao(1);
      await new Promise<void>(resolver => { liberarPrimeira = resolver; });
      await atividade.antesDaRequisicao();
      requisicao(2);
    });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(requisicao).toHaveBeenCalledWith(1);
    let concluirConsulta: () => void = () => undefined;
    const consulta = atividade.consultar(async () => {
      await atividade.consultar(async () => {
        await new Promise<void>(resolver => { concluirConsulta = resolver; });
      });
    });
    liberarPrimeira();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(requisicao).toHaveBeenCalledOnce();
    concluirConsulta();
    await consulta;
    await vi.advanceTimersByTimeAsync(14_999);
    expect(requisicao).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await automatica;
    expect(requisicao).toHaveBeenLastCalledWith(2);
  });

  it('libera atividade após falha e valida contexto antes de cada requisição', async () => {
    await expect(atividade.consultar(async () => { throw new Error('falha'); })).rejects.toThrow('falha');
    const validar = vi.fn().mockResolvedValue(undefined);
    const automatica = atividade.automatizar(new AbortController().signal, validar, async () => {
      await atividade.antesDaRequisicao();
      validar.mockRejectedValue(new Error('sessão mudou'));
      await atividade.antesDaRequisicao();
    });
    const verificacao = expect(automatica).rejects.toThrow('sessão mudou');
    await vi.advanceTimersByTimeAsync(15_000);
    await verificacao;
    expect(validar.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('interrompe espera imediatamente quando o contexto é cancelado', async () => {
    const controlador = new AbortController();
    const automatica = atividade.automatizar(controlador.signal, async () => undefined, () => atividade.antesDaRequisicao());
    const verificacao = expect(automatica).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    controlador.abort();
    await verificacao;
    expect(vi.getTimerCount()).toBe(0);
  });
});
