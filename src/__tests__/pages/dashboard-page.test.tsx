import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DashboardPage } from '@/pages/DashboardPage'

const resumoMock = vi.fn()
const projecoesMock = vi.fn()

const dadosResumoBase = {
  repsPorStatus: [
    { status: 'Pendente', total: 2 },
    { status: 'Em Andamento', total: 1 },
    { status: 'Concluído', total: 3 },
  ],
  repsPrazoProximo: 1,
  repsPrazoVencido: 0,
  laudosPorStatus: [
    { status: 'Em andamento', total: 4 },
    { status: 'Concluído', total: 5 },
    { status: 'Entregue', total: 6 },
  ],
  tempoMedioPorTipoExame: [
    {
      tipoExameId: 'te-1',
      tipoExameNome: 'Balística',
      totalLaudos: 2,
      tempoMedioDias: 5.5,
    },
  ],
  repsRecentes: [
    {
      id: 'rep-1',
      numero: '045-2026',
      tipo_exame_nome: 'Balística',
      status: 'Pendente',
      updated_at: '2026-07-02T10:00:00.000Z',
    },
  ],
  laudosRecentes: [
    {
      id: 'laudo-1',
      rep_numero: '045-2026',
      tipo_exame_nome: 'Balística',
      status: 'Concluído',
      updated_at: '2026-07-02T10:00:00.000Z',
    },
  ],
}

const LocationDisplay = () => {
  const location = useLocation()
  return <div data-testid="rota-atual">{location.pathname}</div>
}

const renderDashboard = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Routes>
      <Route
        path="/dashboard"
        element={(
          <>
            <DashboardPage />
            <LocationDisplay />
          </>
        )}
      />
      <Route path="/laudos" element={<LocationDisplay />} />
      <Route path="/reps" element={<LocationDisplay />} />
      <Route path="/logs" element={<LocationDisplay />} />
    </Routes>
  </MemoryRouter>,
)

describe('DashboardPage', () => {
  beforeEach(() => {
    resumoMock.mockReset()
    projecoesMock.mockReset()

    Object.assign(window.ipcAPI, {
      dashboard: {
        resumo: resumoMock,
        projecoes: projecoesMock,
      },
    })

    vi.mocked(window.sessionStorage.getItem).mockImplementation(chave => {
      if (chave === 'lawdo_auth_user') {
        return JSON.stringify({ nome: 'Silva' })
      }
      return null
    })
  })

  it('deve renderizar a dashboard com dados principais', async () => {
    resumoMock.mockResolvedValue({
      success: true,
      data: dadosResumoBase,
    })

    renderDashboard()

    expect(await screen.findByRole('heading', { name: /reps recentes/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /laudos recentes/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tempo médio de ciclo/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /projeções/i })).toBeInTheDocument()
    expect(screen.getAllByText(/REP 045-2026/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/balística/i).length).toBeGreaterThan(0)
  })

  it('deve exibir estado de erro quando o resumo falha', async () => {
    resumoMock.mockResolvedValue({
      success: false,
      error: 'Falha de IPC',
    })

    renderDashboard()

    expect(await screen.findByText(/não foi possível carregar o dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/falha de ipc/i)).toBeInTheDocument()
  })

  it('deve exibir estado vazio quando não houver dados', async () => {
    resumoMock.mockResolvedValue({
      success: true,
      data: {
        repsPorStatus: [
          { status: 'Pendente', total: 0 },
          { status: 'Em Andamento', total: 0 },
          { status: 'Concluído', total: 0 },
        ],
        repsPrazoProximo: 0,
        repsPrazoVencido: 0,
        laudosPorStatus: [
          { status: 'Em andamento', total: 0 },
          { status: 'Concluído', total: 0 },
          { status: 'Entregue', total: 0 },
        ],
        tempoMedioPorTipoExame: [],
        repsRecentes: [],
        laudosRecentes: [],
      },
    })

    renderDashboard()

    expect(await screen.findByText(/dashboard pronto para começar/i)).toBeInTheDocument()
  })

  it('deve carregar e exibir projeções sob demanda ao expandir a seção', async () => {
    resumoMock.mockResolvedValue({
      success: true,
      data: dadosResumoBase,
    })
    projecoesMock.mockResolvedValue({
      success: true,
      data: {
        historicoMensal: [
          { referencia: '2026-01', ano: 2026, mes: 1, totalConcluidos: 2 },
        ],
        resumoAnual: [
          { ano: 2026, totalConcluidos: 2, mesesComDados: 1 },
        ],
        projecaoMensalEstimada: { referencia: '2026-02', ano: 2026, mes: 2, totalConcluidos: 2 },
        projecaoAnualEstimada: { ano: 2026, totalConcluidos: 24, mesesComDados: 1 },
        baseHistoricaAnalisada: {
          primeiroMes: '2026-01',
          ultimoMes: '2026-01',
          totalLaudosConcluidos: 2,
        },
        indicadorConfiabilidade: {
          dadosInsuficientes: true,
          mesesHistoricos: 1,
          mesesComDados: 1,
          coberturaHistorica: 1,
          nivel: 'baixa',
          mensagem: 'Dados insuficientes para estimativa confiável.',
        },
      },
    })

    renderDashboard()

    expect(projecoesMock).not.toHaveBeenCalled()

    const botaoExpandir = await screen.findByRole('button', { name: /expandir projeções/i })
    expect(botaoExpandir).toHaveAttribute('aria-label', 'Expandir projeções')

    fireEvent.click(botaoExpandir)

    await waitFor(() => expect(projecoesMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: /recolher projeções/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /projeção mensal/i })).toBeInTheDocument()
    expect(screen.getByText(/dados insuficientes para estimativa confiável/i)).toBeInTheDocument()
  })

  it('deve navegar para laudos e reps a partir dos cards do dashboard', async () => {
    resumoMock.mockResolvedValue({
      success: true,
      data: dadosResumoBase,
    })

    const primeiraRenderizacao = renderDashboard()

    await screen.findByText(/laudos recentes/i)

    fireEvent.click(screen.getByRole('button', { name: /abrir laudos/i }))
    expect(await screen.findByTestId('rota-atual')).toHaveTextContent('/laudos')
    primeiraRenderizacao.unmount()

    const segundaRenderizacao = renderDashboard()
    await screen.findByText(/laudos recentes/i)

    fireEvent.click(screen.getByRole('button', { name: /abrir reps/i }))
    expect(await screen.findByTestId('rota-atual')).toHaveTextContent('/reps')
    segundaRenderizacao.unmount()
  })
})
