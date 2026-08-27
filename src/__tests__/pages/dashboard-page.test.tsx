import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DashboardPage } from '@/pages/DashboardPage';

const resumo = vi.fn();
const producao = vi.fn();
const consultarLaudos = vi.fn();
describe('DashboardPage', () => {
  beforeEach(() => {
    resumo.mockReset();
    producao.mockReset();
    consultarLaudos.mockReset();
    window.localStorage.clear();
    Object.assign(window.ipcAPI, {
      dashboard: {
        resumo,
        producaoLaudos: producao,
        consultarLaudos,
        cronologiaLaudo: vi.fn(),
      },
    });
  });
  it('exibe a visão operacional e prioridades', async () => {
    resumo.mockResolvedValue({
      success: true,
      data: {
        repsPorStatus: [],
        laudosPorStatus: [],
        repsPrazoVencido: 1,
        repsPrazoProximo: 2,
        laudosConcluidosAguardandoEntrega: 3,
        laudosEmAndamentoSemAlteracao: 4,
      },
    });
    producao.mockResolvedValue({ success: true, data: [] });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /situação atual/i })).toBeInTheDocument();
    expect(screen.getByText(/REPs vencidas/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /consulta cronológica/i })).toBeInTheDocument();
  });

  it('mostra o estado vazio após uma consulta cronológica válida', async () => {
    resumo.mockResolvedValue({
      success: true,
      data: {
        repsPorStatus: [],
        laudosPorStatus: [],
        repsPrazoVencido: 0,
        repsPrazoProximo: 0,
        laudosConcluidosAguardandoEntrega: 0,
        laudosEmAndamentoSemAlteracao: 0,
      },
    });
    producao.mockResolvedValue({ success: true, data: [] });
    consultarLaudos.mockResolvedValue({
      success: true,
      data: { itens: [], total: 0, pagina: 1, tamanhoPagina: 10, porStatus: [] },
    });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar' }));
    expect(
      await screen.findByText('Nenhum laudo encontrado para os filtros informados.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar gráfico' })).toBeDisabled();
  });

  it('grava localmente os painéis recolhidos', async () => {
    resumo.mockResolvedValue({
      success: true,
      data: {
        repsPorStatus: [],
        laudosPorStatus: [],
        repsPrazoVencido: 0,
        repsPrazoProximo: 0,
        laudosConcluidosAguardandoEntrega: 0,
        laudosEmAndamentoSemAlteracao: 0,
      },
    });
    producao.mockResolvedValue({ success: true, data: [] });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    fireEvent.click((await screen.findAllByRole('button', { name: 'Recolher' }))[0]!);
    expect(screen.getAllByRole('button', { name: 'Expandir' })).toHaveLength(1);
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'dashboard_secoes_expandidas',
      JSON.stringify({ situacao: false, cronologia: true, producao: true })
    );
  });

  it('restaura os painéis a partir da preferência local', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(
      JSON.stringify({ situacao: false, cronologia: true, producao: true })
    );
    resumo.mockResolvedValue({
      success: true,
      data: {
        repsPorStatus: [],
        laudosPorStatus: [],
        repsPrazoVencido: 0,
        repsPrazoProximo: 0,
        laudosConcluidosAguardandoEntrega: 0,
        laudosEmAndamentoSemAlteracao: 0,
      },
    });
    producao.mockResolvedValue({ success: true, data: [] });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(await screen.findAllByRole('button', { name: 'Expandir' })).toHaveLength(1);
  });
});
