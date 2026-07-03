import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

    expect(await screen.findByText(/painel operacional/i)).toBeInTheDocument()
    expect(screen.getByText(/laudos recentes/i)).toBeInTheDocument()
    expect(screen.getByText(/tempo médio de ciclo/i)).toBeInTheDocument()
    expect(screen.getByText(/REP 045-2026/i)).toBeInTheDocument()
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
        laudosRecentes: [],
      },
    })

    renderDashboard()

    expect(await screen.findByText(/dashboard pronto para começar/i)).toBeInTheDocument()
  })

  it('deve abrir o modal de projeções sob demanda', async () => {
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

    fireEvent.click(await screen.findByRole('button', { name: /projeções/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/^projeções$/i)).toBeInTheDocument()
    await waitFor(() => expect(projecoesMock).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/projeção mensal/i)).toBeInTheDocument()
    expect(screen.getByText(/dados insuficientes para estimativa confiável/i)).toBeInTheDocument()
  })

  it('deve navegar para laudos, reps e logs a partir dos atalhos da dashboard', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /REPs cadastrar, revisar e retomar requisições\./i }))
    expect(await screen.findByTestId('rota-atual')).toHaveTextContent('/reps')
    segundaRenderizacao.unmount()

    renderDashboard()
    await screen.findByText(/laudos recentes/i)

    fireEvent.click(screen.getByRole('button', { name: /Logs consultar rastreabilidade e diagnóstico do sistema\./i }))
    expect(await screen.findByTestId('rota-atual')).toHaveTextContent('/logs')
  })
})
