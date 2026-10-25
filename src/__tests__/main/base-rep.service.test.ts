import { esquemaRepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso';
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), executar: vi.fn(), erro: vi.fn() }))

vi.mock('../../main/database/sqlite.js', () => ({
  executeQuery: (...args: unknown[]) => mocks.consultar(...args),
  executeNonQuery: (...args: unknown[]) => mocks.executar(...args),
}))
vi.mock('../../main/utils/logger.js', () => ({ getLogger: () => ({ error: mocks.erro }) }))

import { BaseService } from '../../main/services/base.service'
import { repService } from '../../main/services/rep.service'

type RegistroTeste = { id: string; nome: string; status?: string; created_at: string; updated_at: string }
class ServicoTeste extends BaseService<RegistroTeste> { constructor() { super('registros') } }

describe('BaseService e RepService', () => {
  beforeEach(() => vi.resetAllMocks())

  it('monta filtros, paginação e ordenação sem enviar valores indefinidos ao SQLite', async () => {
    mocks.consultar.mockResolvedValue([])
    await new ServicoTeste().findAll({ nome: 'A', status: undefined }, { limit: 20, offset: 40, orderBy: 'nome', orderDirection: 'ASC' })
    expect(mocks.consultar).toHaveBeenCalledWith(expect.stringContaining('WHERE nome = ?'), ['A', 20, 40])
    expect(mocks.consultar.mock.calls[0]?.[0]).toContain('ORDER BY nome ASC')
  })

  it('não atualiza nem exclui registros ausentes e preserva atualização vazia', async () => {
    mocks.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: '1', nome: 'Original', created_at: '', updated_at: '' }]).mockResolvedValueOnce([])
    const servico = new ServicoTeste()
    await expect(servico.update('ausente', { nome: 'Novo' })).resolves.toBeNull()
    await expect(servico.update('1', {})).resolves.toMatchObject({ nome: 'Original' })
    await expect(servico.delete('ausente')).resolves.toBe(false)
    expect(mocks.executar).not.toHaveBeenCalled()
  })

  it('consulta REP por status e atualiza o status antes de recarregar o registro', async () => {
    mocks.consultar.mockResolvedValueOnce([{ id: 'rep-1' }]).mockResolvedValueOnce([{ id: 'rep-1', status: 'Concluída' }])
    await expect(repService.updateStatus('rep-1', 'Concluída')).resolves.toEqual({ id: 'rep-1', status: 'Concluída' })
    expect(mocks.consultar.mock.calls[0]).toEqual([expect.stringContaining('UPDATE reps SET status'), ['Concluída', 'rep-1']])
    expect(mocks.consultar.mock.calls[1]).toEqual([expect.stringContaining('WHERE id = ?'), ['rep-1']])
  })
})

const referencias = esquemaRepsMesmoCasoGdl.parse({ ambiente: 'producao', numeroRep: '100', anoRep: '2026', numeroCaso: '42', consultadoEm: new Date().toISOString(), reps: [] });

it('salva referências preservando campos e metadados, incluindo edição concorrente', async () => {
  mocks.consultar.mockReset();
  const registro = (campos: unknown) => [{ id: 'rep-1', numero: '100/2026', campos_especificos: JSON.stringify(campos) }];
  mocks.consultar.mockResolvedValueOnce(registro({ b601: { pecas: [] }, integracaoGdl: { origem: 'importacao' } }))
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(registro({ b601: { pecas: ['edicao recente'] }, integracaoGdl: { origem: 'importacao', outro: true } }))
    .mockResolvedValueOnce([{ id: 'rep-1' }]);
  const validar = vi.fn().mockResolvedValue(undefined);
  await repService.salvarReferenciasMesmoCaso('rep-1', '100/2026', referencias, validar);
  const parametros = mocks.consultar.mock.calls[3][1];
  expect(JSON.parse(parametros[0])).toEqual({ b601: { pecas: ['edicao recente'] }, integracaoGdl: { origem: 'importacao', outro: true, repsMesmoCaso: referencias } });
  expect(parametros.slice(1, 3)).toEqual(['rep-1', '100/2026']);
  expect(validar).toHaveBeenCalledTimes(2);
});

it('interrompe gravação se o contexto muda ou os dados locais são inválidos', async () => {
  mocks.consultar.mockReset();
  mocks.consultar.mockResolvedValue([{ id: 'rep-1', numero: '100/2026', campos_especificos: '{}' }]);
  await expect(repService.salvarReferenciasMesmoCaso('rep-1', '100/2026', referencias, async () => { throw new Error('Sessão mudou'); })).rejects.toThrow('Sessão mudou');
  expect(mocks.consultar).toHaveBeenCalledTimes(1);
  mocks.consultar.mockResolvedValue([{ id: 'rep-1', numero: '100/2026', campos_especificos: '[]' }]);
  await expect(repService.salvarReferenciasMesmoCaso('rep-1', '100/2026', referencias, async () => undefined)).rejects.toThrow('dados locais');
});
