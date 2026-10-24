import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgendadorGdlService } from '../../main/services/gdl-agendador.service';
import { AtividadeGdlService } from '../../main/services/gdl-atividade.service';
import type { SnapshotMinhasRepsGdl } from '../../shared/types/gdl-minhas-reps.types';

let agendador: AgendadorGdlService;
let atividade: AtividadeGdlService;
let usuarios: string[];
let habilitada: boolean;
let identidade: string;
let cache: SnapshotMinhasRepsGdl | null;
const atualizar = vi.fn<(usuario: string, validar: () => Promise<void>) => Promise<SnapshotMinhasRepsGdl>>();
const registrarFalha = vi.fn<(erro: unknown) => number>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  atividade = new AtividadeGdlService();
  usuarios = ['perito'];
  habilitada = true;
  identidade = 'identidade-a';
  cache = null;
  registrarFalha.mockReset().mockReturnValue(0);
  atualizar.mockReset().mockImplementation(async (_usuario, validar) => {
    await validar();
    cache = { reps: [], atualizadoEm: new Date().toISOString() };
    agendador.listaAlterada();
    return cache;
  });
  agendador = new AgendadorGdlService({
    obterUsuarios: () => usuarios,
    habilitada: async () => habilitada,
    identidade: async () => identidade,
    obterCache: async () => cache,
    atualizar,
    registrarFalha,
  }, atividade);
});

afterEach(async () => {
  agendador.encerrar();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
});

describe('atualização automática da lista GDL no main', () => {
  it('atualiza sem dashboard a cada cinco minutos após a conclusão', async () => {
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(atualizar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(atualizar).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(299_999);
    expect(atualizar).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(atualizar).toHaveBeenCalledTimes(2);
  });

  it('aproveita o cache e reinicia o prazo após atualização manual', async () => {
    cache = { reps: [], atualizadoEm: new Date(Date.now() - 240_000).toISOString() };
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(atualizar).not.toHaveBeenCalled();
    cache = { reps: [], atualizadoEm: new Date().toISOString() };
    agendador.listaAlterada();
    await vi.advanceTimersByTimeAsync(299_999);
    expect(atualizar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(atualizar).toHaveBeenCalledOnce();
  });

  it('aguarda consultas completas e quinze segundos sem novas consultas', async () => {
    let concluir: () => void = () => undefined;
    const consulta = atividade.consultar(() => new Promise<void>(resolver => { concluir = resolver; }));
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(atualizar).not.toHaveBeenCalled();
    concluir();
    await consulta;
    await vi.advanceTimersByTimeAsync(10_000);
    await atividade.consultar(async () => undefined);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(atualizar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(atualizar).toHaveBeenCalledOnce();
  });

  it('não acumula atualizações durante consulta longa nem duplica usuários de várias janelas', async () => {
    usuarios = ['perito', 'perito'];
    let concluir: () => void = () => undefined;
    atualizar.mockImplementationOnce(async (_usuario, validar) => {
      await new Promise<void>(resolver => { concluir = resolver; });
      await validar();
      cache = { reps: [], atualizadoEm: new Date().toISOString() };
      return cache;
    });
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(15_000);
    agendador.listaAlterada();
    await vi.advanceTimersByTimeAsync(900_000);
    expect(atualizar).toHaveBeenCalledOnce();
    concluir();
    await vi.advanceTimersByTimeAsync(299_999);
    expect(atualizar).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(atualizar).toHaveBeenCalledTimes(2);
  });

  it.each(['logout', 'desativacao', 'configuracao', 'encerramento'])('cancela trabalho pendente por %s', async motivo => {
    let concluir: () => void = () => undefined;
    const consulta = atividade.consultar(() => new Promise<void>(resolver => { concluir = resolver; }));
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(15_000);
    if (motivo === 'logout') usuarios = [];
    if (motivo === 'desativacao') habilitada = false;
    if (motivo === 'configuracao') { identidade = 'identidade-b'; habilitada = false; }
    if (motivo === 'encerramento') agendador.encerrar();
    else agendador.contextoAlterado();
    concluir();
    await consulta;
    await vi.advanceTimersByTimeAsync(600_000);
    expect(atualizar).not.toHaveBeenCalled();
    expect(registrarFalha).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('invalida o contexto durante consulta e não salva resultado de sessão antiga', async () => {
    let concluir: () => void = () => undefined;
    const salvar = vi.fn();
    atualizar.mockImplementationOnce(async (_usuario, validar) => {
      await new Promise<void>(resolver => { concluir = resolver; });
      await validar();
      salvar();
      return { reps: [], atualizadoEm: new Date().toISOString() };
    });
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(15_000);
    usuarios = [];
    agendador.contextoAlterado();
    concluir();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(salvar).not.toHaveBeenCalled();
    expect(registrarFalha).not.toHaveBeenCalled();
  });

  it.each([0, 600_000])('preserva cache e respeita intervalo de nova tentativa de %i ms', async bloqueio => {
    cache = { reps: [], atualizadoEm: new Date(Date.now() - 600_000).toISOString() };
    const anterior = cache;
    registrarFalha.mockReturnValue(bloqueio);
    atualizar.mockRejectedValueOnce(new Error('VPN indisponível'));
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(cache).toBe(anterior);
    expect(registrarFalha).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(Math.max(300_000, bloqueio) - 1);
    expect(atualizar).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(atualizar).toHaveBeenCalledTimes(2);
  });

  it('reinicia o intervalo após sucesso manual mesmo depois de bloqueio prolongado', async () => {
    registrarFalha.mockReturnValue(600_000);
    atualizar.mockRejectedValueOnce(new Error('Bloqueio temporário'));
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(60_000);
    cache = { reps: [], atualizadoEm: new Date().toISOString() };
    agendador.listaAlterada('perito', identidade);
    await vi.advanceTimersByTimeAsync(299_999);
    expect(atualizar).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(atualizar).toHaveBeenCalledTimes(2);
  });

  it('não consulta com sessão ausente ou listagem desligada e retoma ao habilitar', async () => {
    usuarios = [];
    agendador.iniciar();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(vi.getTimerCount()).toBe(0);
    usuarios = ['perito'];
    habilitada = false;
    agendador.contextoAlterado();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(atualizar).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    habilitada = true;
    agendador.contextoAlterado();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(atualizar).toHaveBeenCalledOnce();
  });
});
