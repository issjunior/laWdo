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
