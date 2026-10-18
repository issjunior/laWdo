import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { DashboardPage } from '@/pages/DashboardPage';

vi.mock('@/components/rep/GdlMinhasRepsDashboard', () => ({
  GdlMinhasRepsDashboard: () => <div>Lista GDL disponível</div>,
}));
const resumo = vi.fn();
const producao = vi.fn();
const consultarLaudos = vi.fn();
const cronologiaLaudo = vi.fn();
const resumoPadrao = {
  repsPorStatus: [],
  laudosPorStatus: [],
  repsPrazoVencido: 1,
  repsPrazoProximo: 2,
  laudosConcluidosAguardandoEntrega: 3,
  laudosEmAndamentoSemAlteracao: 4,
};
const laudo = {
  id: 'laudo-1',
  repId: 'rep-1',
  repNumero: '001',
  tipoExameNome: 'Balística',
  status: 'Concluído',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
  dataConclusao: '2026-01-03',
  dataEntrega: null,
  dataOrdenacao: '2026-01-03',
};
function RotaAtual() {
  return (
    <output data-testid="rota">
      {useLocation().pathname}
      {useLocation().search}
    </output>
  );
}
function montar() {
  render(
    <MemoryRouter>
      <DashboardPage />
      <RotaAtual />
    </MemoryRouter>
  );
}
async function abrirConsulta() {
  fireEvent.click(screen.getByRole('button', { name: 'Consulta cronológica' }));
  await screen.findByRole('dialog', { name: 'Consulta cronológica' });
}

afterEach(() => vi.useRealTimers());

describe('DashboardPage', () => {
  beforeEach(() => {
    resumo.mockReset().mockResolvedValue({ success: true, data: resumoPadrao });
    producao.mockReset().mockResolvedValue({ success: true, data: [] });
    consultarLaudos.mockReset().mockResolvedValue({
      success: true,
      data: {
        itens: [],
        total: 0,
        pagina: 1,
        tamanhoPagina: 10,
        porStatus: [],
      },
    });
    cronologiaLaudo.mockReset();
    window.localStorage.clear();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    Object.assign(window.ipcAPI, {
      dashboard: { resumo, producaoLaudos: producao, consultarLaudos, cronologiaLaudo },
    });
  });

  it('mantém GDL e indicadores visíveis e ignora preferências antigas dos painéis', async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation(chave =>
      chave === 'dashboard_secoes_expandidas'
        ? JSON.stringify({ repsGdl: false, cronologia: true })
        : chave === 'dashboard_ordem_secoes'
          ? JSON.stringify(['producao', 'repsGdl'])
          : null
    );
    montar();
    expect(screen.getByText('Lista GDL disponível')).toBeInTheDocument();
    expect(await screen.findByText('REPs vencidas')).toBeInTheDocument();
    expect(screen.getByText('REPs vencendo em até 7 dias')).toBeInTheDocument();
    expect(screen.getByText('Laudos concluídos aguardando entrega')).toBeInTheDocument();
    expect(screen.getByText('Laudos sem alteração há 7 dias')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Expandir|Recolher|Reordenar/ })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /1 REPs vencidas/ }));
    expect(screen.getByTestId('rota')).toHaveTextContent('/reps?prioridade=vencida');
  });

  it('abre gráficos e produção em modais separados e preserva o tipo do gráfico', async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation(chave =>
      chave === 'dashboard_tipo_grafico' ? 'barras' : null
    );
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Situação atual' }));
    expect(await screen.findByRole('dialog', { name: 'Situação atual' })).toBeInTheDocument();
    expect(screen.getByText('Status das REPs')).toBeInTheDocument();
    expect(screen.getByLabelText('Visualização')).toHaveTextContent('Barras horizontais');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' }));
    expect(await screen.findByRole('dialog', { name: 'Produção de laudos' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(await screen.findByText('Nenhuma amostra válida encontrada.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Conclusão inicial'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Conclusão final'), { target: { value: '2026-01-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(producao).toHaveBeenLastCalledWith({
      dataInicial: '2026-01-01',
      dataFinal: '2026-01-31',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' }));
    expect(await screen.findByLabelText('Conclusão inicial')).toHaveValue('2026-01-01');
  });

  it('mostra consulta vazia e mantém filtros e resultados ao reabrir', async () => {
    montar();
    await abrirConsulta();
    fireEvent.change(screen.getByLabelText('Busca'), { target: { value: 'REP 001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(
      await screen.findByText('Nenhum laudo encontrado para os filtros informados.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar gráfico' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await abrirConsulta();
    expect(screen.getByLabelText('Busca')).toHaveValue('REP 001');
    expect(
      screen.getByText('Nenhum laudo encontrado para os filtros informados.')
    ).toBeInTheDocument();
  });

  it('consulta, pagina e apresenta gráfico e cronologia no mesmo modal', async () => {
    consultarLaudos.mockResolvedValue({
      success: true,
      data: {
        itens: [laudo],
        total: 11,
        pagina: 1,
        tamanhoPagina: 10,
        porStatus: [],
      },
    });
    cronologiaLaudo.mockResolvedValue({
      success: true,
      data: {
        laudo,
        marcos: [{ nome: 'Criação', data: '2026-01-01' }],
        transicoes: [
          { data: '2026-01-03', statusAnterior: 'Em andamento', statusNovo: 'Concluído' },
        ],
      },
    });
    montar();
    await abrirConsulta();
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    await screen.findByRole('button', { name: /REP 001.*Balística/i });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar gráfico' }));
    expect(screen.getByRole('dialog', { name: 'Distribuição por status' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à consulta' }));
    fireEvent.click(screen.getByRole('button', { name: /REP 001.*Balística/i }));
    expect(await screen.findByText('Transições auditadas')).toBeInTheDocument();
    expect(cronologiaLaudo).toHaveBeenCalledWith('laudo-1');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à consulta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(consultarLaudos).toHaveBeenLastCalledWith(
      expect.objectContaining({ pagina: 2, dataInicial: '2026-01-01' })
    );
  });

  it('preserva GDL durante carregamento e falha do resumo e permite tentar novamente', async () => {
    resumo.mockReturnValueOnce(new Promise(() => undefined));
    montar();
    expect(screen.getByText('Lista GDL disponível')).toBeInTheDocument();
    expect(screen.getByText('Carregando indicadores...')).toBeInTheDocument();
  });

  it('recupera o resumo e apresenta falhas da consulta sem bloquear o GDL', async () => {
    resumo.mockResolvedValueOnce({ success: false, error: 'Falha no resumo' });
    montar();
    expect(await screen.findByText('Falha no resumo')).toBeInTheDocument();
    expect(screen.getByText('Lista GDL disponível')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('REPs vencidas');
    consultarLaudos.mockRejectedValue(new Error('Falha na consulta'));
    await abrirConsulta();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(await screen.findByText('Falha na consulta')).toBeInTheDocument();
  });

  it('mantém a aba por laudo e comunica falha da cronologia', async () => {
    consultarLaudos.mockResolvedValue({
      success: true,
      data: {
        itens: [laudo],
        total: 1,
        pagina: 1,
        tamanhoPagina: 10,
        porStatus: [],
      },
    });
    cronologiaLaudo.mockRejectedValue(new Error('Falha na cronologia'));
    montar();
    await abrirConsulta();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Por laudo' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.change(screen.getByPlaceholderText('Número da REP, código ou natureza'), {
      target: { value: '001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar laudo' }));
    fireEvent.click(await screen.findByRole('button', { name: /REP 001.*Balística/i }));
    expect(await screen.findByText('Falha na cronologia')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await abrirConsulta();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Por laudo' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    expect(screen.getByPlaceholderText('Número da REP, código ou natureza')).toHaveValue('001');
  });
  it('carrega produção na primeira abertura, reutiliza resultados e permite atualizar manualmente', async () => {
    montar();
    await screen.findByText('REPs vencidas');
    expect(producao).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' }));
    await screen.findByText('Nenhuma amostra válida encontrada.');
    expect(producao).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' }));
    expect(producao).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(producao).toHaveBeenCalledTimes(2));
  });

  it('atualiza aos dez minutos apenas com modal aberto e usa filtros aplicados', async () => {
    vi.useFakeTimers();
    await act(async () => montar());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' })));
    expect(producao).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Conclusão inicial'), { target: { value: '2026-01-01' } });
    await act(async () => vi.advanceTimersByTimeAsync(599_999));
    expect(producao).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(producao).toHaveBeenCalledTimes(2);
    expect(producao).toHaveBeenLastCalledWith({});
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' })));
    expect(producao).toHaveBeenLastCalledWith({ dataInicial: '2026-01-01' });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Close' })));
    await act(async () => vi.advanceTimersByTimeAsync(600_000));
    expect(producao).toHaveBeenCalledTimes(3);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' })));
    expect(producao).toHaveBeenCalledTimes(4);
    expect(producao).toHaveBeenLastCalledWith({ dataInicial: '2026-01-01' });
  });

  it('preserva resultados e horário na falha automática e espera dez minutos antes de repetir', async () => {
    vi.useFakeTimers();
    await act(async () => montar());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' })));
    const horario = screen.getByText(/^Atualizado em /).textContent;
    producao.mockResolvedValue({ success: false, error: 'Produção indisponível' });
    await act(async () => vi.advanceTimersByTimeAsync(600_000));
    expect(screen.getByText('Produção indisponível')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma amostra válida encontrada.')).toBeInTheDocument();
    expect(screen.getByText(/^Atualizado em /)).toHaveTextContent(horario ?? '');
    expect(producao).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(599_999));
    expect(producao).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(producao).toHaveBeenCalledTimes(3);
    producao.mockResolvedValue({ success: true, data: [] });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Atualizar' })));
    expect(producao).toHaveBeenCalledTimes(4);
    expect(screen.queryByText('Produção indisponível')).not.toBeInTheDocument();
    expect(screen.getByText(/^Atualizado em /).textContent).not.toBe(horario);
  });

  it('não duplica produção pendente ao fechar e reabrir o modal', async () => {
    producao.mockReturnValue(new Promise(() => undefined));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' }));
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Produção de laudos' }));
    expect(producao).toHaveBeenCalledTimes(1);
  });

});
