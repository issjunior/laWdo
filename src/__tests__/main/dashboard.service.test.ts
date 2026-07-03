import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardService, avaliarConfiabilidadeHistorico, estimarProjecoes, resumirSerieAnual } from '../../main/services/dashboard.service'

const executeQueryMock = vi.fn()

vi.mock('../../main/database/sqlite.js', () => ({
  executeQuery: (...args: unknown[]) => executeQueryMock(...args),
}))

describe('dashboard.service', () => {
  beforeEach(() => {
    executeQueryMock.mockReset()
  })

  it('deve consolidar o resumo do dashboard', async () => {
    executeQueryMock
      .mockResolvedValueOnce([
        { status: 'Pendente', total: 2 },
        { status: 'Em Andamento', total: 3 },
        { status: 'Concluído', total: 4 },
      ])
      .mockResolvedValueOnce([{ total: 5 }])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { status: 'Em andamento', total: 6 },
        { status: 'Concluído', total: 7 },
        { status: 'Entregue', total: 8 },
      ])
      .mockResolvedValueOnce([
        { tipoExameId: 'te-1', tipoExameNome: 'Balística', totalLaudos: 2, tempoMedioDias: 6.4 },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rep-1',
          numero: '045-2026',
          tipo_exame_nome: 'Balística',
          status: 'Em Andamento',
          updated_at: '2026-07-02T09:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'laudo-1',
          rep_numero: '045-2026',
          tipo_exame_nome: 'Balística',
          status: 'Concluído',
          updated_at: '2026-07-02T10:00:00.000Z',
        },
      ])

    const service = new DashboardService()
    const resumo = await service.obterResumo()

    expect(resumo.repsPorStatus).toEqual([
      { status: 'Pendente', total: 2 },
      { status: 'Em Andamento', total: 3 },
      { status: 'Concluído', total: 4 },
    ])
    expect(resumo.repsPrazoProximo).toBe(5)
    expect(resumo.repsPrazoVencido).toBe(1)
    expect(resumo.laudosPorStatus).toEqual([
      { status: 'Em andamento', total: 6 },
      { status: 'Concluído', total: 7 },
      { status: 'Entregue', total: 8 },
    ])
    expect(resumo.tempoMedioPorTipoExame[0]?.tempoMedioDias).toBe(6.4)
    expect(resumo.repsRecentes[0]?.numero).toBe('045-2026')
    expect(resumo.laudosRecentes[0]?.rep_numero).toBe('045-2026')
  })

  it('deve consolidar projeções com base histórica suficiente', async () => {
    executeQueryMock.mockResolvedValueOnce([
      { referencia: '2025-01', ano: 2025, mes: 1, totalConcluidos: 2 },
      { referencia: '2025-02', ano: 2025, mes: 2, totalConcluidos: 3 },
      { referencia: '2025-03', ano: 2025, mes: 3, totalConcluidos: 4 },
      { referencia: '2025-04', ano: 2025, mes: 4, totalConcluidos: 3 },
      { referencia: '2025-05', ano: 2025, mes: 5, totalConcluidos: 5 },
      { referencia: '2025-06', ano: 2025, mes: 6, totalConcluidos: 4 },
      { referencia: '2025-07', ano: 2025, mes: 7, totalConcluidos: 4 },
      { referencia: '2025-08', ano: 2025, mes: 8, totalConcluidos: 5 },
      { referencia: '2025-09', ano: 2025, mes: 9, totalConcluidos: 4 },
      { referencia: '2025-10', ano: 2025, mes: 10, totalConcluidos: 4 },
      { referencia: '2025-11', ano: 2025, mes: 11, totalConcluidos: 5 },
      { referencia: '2025-12', ano: 2025, mes: 12, totalConcluidos: 6 },
    ])

    const service = new DashboardService()
    const projecoes = await service.obterProjecoes()

    expect(projecoes.historicoMensal).toHaveLength(12)
    expect(projecoes.resumoAnual).toEqual([
      { ano: 2025, totalConcluidos: 49, mesesComDados: 12 },
    ])
    expect(projecoes.projecaoMensalEstimada?.referencia).toBe('2026-01')
    expect(projecoes.projecaoAnualEstimada?.totalConcluidos).toBeGreaterThan(0)
    expect(projecoes.indicadorConfiabilidade.dadosInsuficientes).toBe(false)
  })

  it('deve marcar série curta como insuficiente', () => {
    const serie = [
      { referencia: '2026-01', ano: 2026, mes: 1, totalConcluidos: 2 },
      { referencia: '2026-03', ano: 2026, mes: 3, totalConcluidos: 1 },
    ]

    const indicador = avaliarConfiabilidadeHistorico(
      [
        { referencia: '2026-01', ano: 2026, mes: 1, totalConcluidos: 2 },
        { referencia: '2026-02', ano: 2026, mes: 2, totalConcluidos: 0 },
        { referencia: '2026-03', ano: 2026, mes: 3, totalConcluidos: 1 },
      ],
      serie,
    )

    expect(indicador.dadosInsuficientes).toBe(true)
    expect(indicador.mensagem).toMatch(/insuficientes/i)
  })

  it('deve resumir série anual e estimar projeções', () => {
    const serie = [
      { referencia: '2025-11', ano: 2025, mes: 11, totalConcluidos: 4 },
      { referencia: '2025-12', ano: 2025, mes: 12, totalConcluidos: 6 },
      { referencia: '2026-01', ano: 2026, mes: 1, totalConcluidos: 5 },
    ]

    expect(resumirSerieAnual(serie)).toEqual([
      { ano: 2025, totalConcluidos: 10, mesesComDados: 2 },
      { ano: 2026, totalConcluidos: 5, mesesComDados: 1 },
    ])

    const estimativa = estimarProjecoes(serie)
    expect(estimativa.projecaoMensalEstimada?.referencia).toBe('2026-02')
    expect(estimativa.projecaoAnualEstimada?.totalConcluidos).toBeGreaterThan(0)
  })
})
