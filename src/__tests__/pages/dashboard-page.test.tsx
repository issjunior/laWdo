import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DashboardPage } from '@/pages/DashboardPage';

const resumo = vi.fn();
const producao = vi.fn();
const consultarLaudos = vi.fn();
const cronologiaLaudo = vi.fn();
describe('DashboardPage', () => {
  beforeEach(() => {
    resumo.mockReset();
    producao.mockReset();
    consultarLaudos.mockReset();
    cronologiaLaudo.mockReset();
    window.localStorage.clear();
    Object.assign(window.ipcAPI, {
      dashboard: {
        resumo,
        producaoLaudos: producao,
        consultarLaudos,
        cronologiaLaudo,
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
    producao.mockResolvedValue({
      success: true,
      data: [
        {
          natureza: { id: 'tipo-1', codigo: 'BAL', nome: 'Balística' },
          repAteConclusao: { quantidade: 1, mediaDias: 2, medianaDias: 2 },
          laudoAteConclusao: { quantidade: 1, mediaDias: 1, medianaDias: 1 },
        },
      ],
    });
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
    producao.mockResolvedValue({
      success: true,
      data: [
        {
          natureza: { id: 'tipo-1', codigo: 'BAL', nome: 'Balística' },
          repAteConclusao: { quantidade: 1, mediaDias: 2, medianaDias: 2 },
          laudoAteConclusao: { quantidade: 1, mediaDias: 1, medianaDias: 1 },
        },
      ],
    });
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

  it('consulta, pagina e apresenta a cronologia de um laudo', async () => {
    resumo.mockResolvedValue({
      success: true,
      data: {
        repsPorStatus: [{ status: 'Pendente', total: 1 }],
        laudosPorStatus: [{ status: 'Concluído', total: 1 }],
        repsPrazoVencido: 1,
        repsPrazoProximo: 0,
        laudosConcluidosAguardandoEntrega: 0,
        laudosEmAndamentoSemAlteracao: 0,
      },
    });
    producao.mockResolvedValue({ success: true, data: [] });
    consultarLaudos.mockResolvedValue({
      success: true,
      data: {
        itens: [
          {
            id: 'laudo-1',
            repId: 'rep-1',
            repNumero: '001',
            tipoExameId: 'tipo-1',
            tipoExameCodigo: 'BAL',
            tipoExameNome: 'Balística',
            status: 'Concluído',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            dataConclusao: '2026-01-03',
            dataEntrega: null,
            dataOrdenacao: '2026-01-03',
          },
        ],
        total: 11,
        pagina: 1,
        tamanhoPagina: 10,
        porStatus: [{ status: 'Concluído', total: 11 }],
      },
    });
    cronologiaLaudo.mockResolvedValue({
      success: true,
      data: {
        laudo: {
          id: 'laudo-1',
          repId: 'rep-1',
          repNumero: '001',
          tipoExameId: 'tipo-1',
          tipoExameCodigo: 'BAL',
          tipoExameNome: 'Balística',
          status: 'Concluído',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          dataConclusao: '2026-01-03',
          dataEntrega: null,
          dataOrdenacao: '2026-01-03',
        },
        marcos: [{ nome: 'Criação', data: '2026-01-01' }],
        transicoes: [
          { data: '2026-01-03', statusAnterior: 'Em andamento', statusNovo: 'Concluído' },
        ],
      },
    });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Consultar' }));
    expect(await screen.findByRole('button', { name: /REP 001.*Balística/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Busca'), { target: { value: 'REP 001' } });
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-01-31' } });
    fireEvent.change(screen.getByLabelText('Conclusão inicial'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Conclusão final'), {
      target: { value: '2026-01-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(producao).toHaveBeenLastCalledWith({
      dataInicial: '2026-01-01',
      dataFinal: '2026-01-31',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar gráfico' }));
    expect(await screen.findByText(/Distribuição por status/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: /REP 001.*Balística/i }));
    expect(await screen.findByText(/Transições auditadas/i)).toBeInTheDocument();
    expect(cronologiaLaudo).toHaveBeenCalledWith('laudo-1');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(consultarLaudos).toHaveBeenLastCalledWith(
      expect.objectContaining({ pagina: 2 })
    );
  });

  it('busca por laudo e comunica falhas de carregamento', async () => {
    resumo.mockResolvedValue({ success: false, error: 'Falha no resumo' });
    producao.mockResolvedValue({ success: true, data: [] });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Falha no resumo')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(await screen.findByRole('heading', { name: /situação atual/i })).toBeInTheDocument();
    consultarLaudos.mockResolvedValue({ success: false, error: 'Falha na consulta' });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Falha na consulta')).toBeInTheDocument();
  });
});
