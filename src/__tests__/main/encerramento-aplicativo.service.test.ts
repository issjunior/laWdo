import { describe, expect, it, vi } from 'vitest';
import { EncerramentoAplicativoService } from '@main/services/encerramento-aplicativo.service.js';

function barreira() {
  let liberar = () => undefined as void;
  const promessa = new Promise<void>(resolver => { liberar = resolver; });
  return { promessa, liberar };
}

describe('encerramento do aplicativo', () => {
  it('bloqueia solicitações repetidas até terminar a mesma limpeza e libera a saída seguinte', async () => {
    const pendente = barreira();
    const limpar = vi.fn(() => pendente.promessa);
    const fecharBanco = vi.fn(async () => undefined);
    const sair = vi.fn();
    const servico = new EncerramentoAplicativoService({
      grupos: [[{ nome: 'serviço', executar: limpar }]], fecharBanco, sair, registrarFalha: vi.fn(),
    });
    const evento = { preventDefault: vi.fn() };
    servico.solicitar(evento);
    servico.solicitar(evento);
    await vi.waitFor(() => expect(limpar).toHaveBeenCalledOnce());
    expect(evento.preventDefault).toHaveBeenCalledTimes(2);
    expect(fecharBanco).not.toHaveBeenCalled();
    expect(sair).not.toHaveBeenCalled();
    pendente.liberar();
    await vi.waitFor(() => expect(sair).toHaveBeenCalledOnce());
    servico.solicitar(evento);
    expect(evento.preventDefault).toHaveBeenCalledTimes(2);
    expect(limpar).toHaveBeenCalledOnce();
    expect(fecharBanco).toHaveBeenCalledOnce();
  });

  it('aguarda as demais tarefas mesmo quando uma falha e fecha o banco por último', async () => {
    const pendente = barreira();
    const ordem: string[] = [];
    const erro = new Error('Falha simulada');
    const registrarFalha = vi.fn();
    const fecharBanco = vi.fn(async () => { ordem.push('banco'); });
    const sair = vi.fn(() => { ordem.push('saída'); });
    const servico = new EncerramentoAplicativoService({
      grupos: [
        [
          { nome: 'falha', executar: async () => { throw erro; } },
          { nome: 'pendente', executar: async () => { await pendente.promessa; ordem.push('pendente'); } },
        ],
        [{ nome: 'logs', executar: () => { ordem.push('logs'); } }],
      ], fecharBanco, sair, registrarFalha,
    });
    servico.solicitar({ preventDefault: vi.fn() });
    await Promise.resolve();
    await Promise.resolve();
    expect(fecharBanco).not.toHaveBeenCalled();
    expect(sair).not.toHaveBeenCalled();
    pendente.liberar();
    await vi.waitFor(() => expect(sair).toHaveBeenCalledOnce());
    expect(ordem).toEqual(['pendente', 'logs', 'banco', 'saída']);
    expect(registrarFalha).toHaveBeenCalledExactlyOnceWith('falha', erro);
  });

  it('registra falhas síncronas e do banco sem pular as etapas restantes', async () => {
    const erroServico = new Error('Falha síncrona');
    const erroBanco = new Error('Falha no banco');
    const registrarFalha = vi.fn();
    const concluirLogs = vi.fn();
    const sair = vi.fn();
    const servico = new EncerramentoAplicativoService({
      grupos: [[
        { nome: 'serviço', executar: () => { throw erroServico; } },
        { nome: 'logs', executar: concluirLogs },
      ]],
      fecharBanco: async () => { throw erroBanco; }, registrarFalha, sair,
    });
    servico.solicitar({ preventDefault: vi.fn() });
    await vi.waitFor(() => expect(sair).toHaveBeenCalledOnce());
    expect(concluirLogs).toHaveBeenCalledOnce();
    expect(registrarFalha.mock.calls).toEqual([['serviço', erroServico], ['banco de dados', erroBanco]]);
  });
});
