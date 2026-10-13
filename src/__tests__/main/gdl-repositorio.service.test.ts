import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const ambiente = vi.hoisted(() => ({ diretorio: '' }));
vi.mock('electron', () => ({ app: { getPath: () => ambiente.diretorio } }));
import { obterListaRepositorioGdl, obterRepRepositorioGdl, registrarConsultaRepositorioGdl, registrarGradeGdl } from '../../main/services/gdl-repositorio.service';
const rep = { idGdl: 123, numero: '123', ano: '2026', naturezaExame: 'EXAME DE CONSTATAÇÃO', naturezaExameComCodigo: null, status: 'Aberta e Distribuída' as const, dataDesignacao: null, quantidadeFotos: null };
beforeEach(async () => { ambiente.diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-repositorio-')); });
afterEach(async () => { await rm(ambiente.diretorio, { recursive: true, force: true }); });
describe('repositório unificado GDL', () => {
  it('compartilha confirmação entre consulta e lista, isolando contas', async () => {
    await registrarGradeGdl('u1', 'conexao1', { reps: [rep], atualizadoEm: '2026-01-01T00:00:00.000Z' });
    await registrarConsultaRepositorioGdl('u1', 'conexao1', 123, '123', '2026', { fonte: 'detalhes', dados: { natureza: 'I806 - EXAME DE CONSTATAÇÃO', quesito: { estado: 'vazio', valor: '' }, dataSolicitacao: { estado: 'presente', valor: '2026-08-21' } } });
    expect((await obterListaRepositorioGdl('u1', 'conexao1'))?.reps[0]).toMatchObject({ naturezaExameComCodigo: 'I806 - EXAME DE CONSTATAÇÃO', naturezaConfirmada: true, statusNecessitaAtualizacao: true });
    expect(await obterListaRepositorioGdl('u2', 'conexao1')).toBeNull();
    expect(await obterListaRepositorioGdl('u1', 'conexao2')).toBeNull();
    await expect(registrarConsultaRepositorioGdl('u1', 'conexao1', 123, '999', '2026', { fonte: 'api', dados: {}, natureza: null, status: null })).rejects.toThrow('Identidade');
  });
  it('não rebaixa confirmação compatível e sinaliza divergência posterior', async () => {
    await registrarConsultaRepositorioGdl('u', 'c', 123, '123', '2026', { fonte: 'detalhes', dados: { natureza: 'I806 - EXAME DE CONSTATAÇÃO', quesito: { estado: 'ausente', valor: '' }, dataSolicitacao: { estado: 'ausente', valor: '' } } });
    await registrarGradeGdl('u', 'c', { reps: [rep], atualizadoEm: '2099-01-01T00:00:00.000Z' });
    expect((await obterListaRepositorioGdl('u', 'c'))?.reps[0].naturezaConfirmada).toBe(true);
    await registrarGradeGdl('u', 'c', { reps: [{ ...rep, naturezaExame: 'B602 - EXAME DE EFICIÊNCIA E PRESTABILIDADE' }], atualizadoEm: '2099-01-01T00:00:01.000Z' });
    expect((await obterListaRepositorioGdl('u', 'c'))?.reps[0]).toMatchObject({ naturezaDivergente: true, naturezaConfirmada: false });
    expect((await obterRepRepositorioGdl('u', 'c', 123, '123', '2026'))?.detalhes?.dados.natureza).toBe('I806 - EXAME DE CONSTATAÇÃO');
  });
  it('preserva a versão salva quando a validação antes da gravação falha', async () => {
    await registrarGradeGdl('u', 'c', { reps: [rep], atualizadoEm: '2026-01-01T00:00:00.000Z' });
    await expect(registrarGradeGdl('u', 'c', { reps: [], atualizadoEm: '2026-01-02T00:00:00.000Z' }, async () => { throw new Error('Preferência desativada'); })).rejects.toThrow('desativada');
    expect((await obterListaRepositorioGdl('u', 'c'))?.reps).toHaveLength(1);
  });
  it('marca o status anterior como pendente após tentativa sem inventar confirmação', async () => {
    await registrarGradeGdl('u', 'c', { reps: [rep], atualizadoEm: '2026-01-01T00:00:00.000Z' });
    await registrarConsultaRepositorioGdl('u', 'c', 123, '123', '2026', { fonte: 'acesso_detalhes' });
    expect((await obterListaRepositorioGdl('u', 'c'))?.reps[0]).toMatchObject({ status: 'Aberta e Distribuída', statusNecessitaAtualizacao: true, naturezaConfirmada: false });
    expect((await obterRepRepositorioGdl('u', 'c', 123, '123', '2026'))?.detalhes).toBeUndefined();
  });
  it('preserva os últimos campos reconhecidos quando uma página posterior os omite', async () => {
    await registrarConsultaRepositorioGdl('u', 'c', 123, '123', '2026', { fonte: 'detalhes', dados: { natureza: 'I806 - EXAME DE CONSTATAÇÃO', quesito: { estado: 'presente', valor: 'Anterior' }, dataSolicitacao: { estado: 'presente', valor: '2026-08-21' } } });
    await registrarConsultaRepositorioGdl('u', 'c', 123, '123', '2026', { fonte: 'detalhes', dados: { natureza: null, quesito: { estado: 'ausente', valor: '' }, dataSolicitacao: { estado: 'vazio', valor: '' } } });
    const registro = await obterRepRepositorioGdl('u', 'c', 123, '123', '2026');
    expect(registro?.ultimosDetalhesReconhecidos).toMatchObject({ natureza: { valor: 'I806 - EXAME DE CONSTATAÇÃO' }, quesito: { dados: { valor: 'Anterior' } }, dataSolicitacao: { dados: { estado: 'vazio', valor: '' } } });
    expect(registro?.detalhes?.dados.quesito.estado).toBe('ausente');
  });
});
