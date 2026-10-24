import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosReiteracaoProvider } from '@/contexts/AvisosReiteracaoContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GdlMinhasRepsDashboard } from '@/components/rep/GdlMinhasRepsDashboard';

const ipcApiOriginal = window.ipcAPI;
const obterMinhasRepsCache = vi.fn();
const atualizarMinhasRepsCache = vi.fn();
const obterPreferenciaListagem = vi.fn();
const snapshot = { atualizadoEm: '2026-10-01T12:00:00.000Z', reps: [
  { idGdl: 8, numero: '123', ano: '2026', status: 'Aberta e Distribuída', naturezaExame: 'EXAME', naturezaExameComCodigo: 'B601 - EXAME', dataDesignacao: '2026-10-01T10:00', quantidadeFotos: 4 },
] };

function RotaAtual() {
  const local = useLocation();
  return <output data-testid="rota-atual">{JSON.stringify({ pathname: local.pathname, state: local.state })}</output>;
}

beforeEach(() => {
  vi.mocked(window.localStorage.getItem).mockReset().mockReturnValue(null);
  vi.mocked(window.localStorage.setItem).mockReset();
  HTMLElement.prototype.scrollIntoView = () => undefined;
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  obterPreferenciaListagem.mockReset().mockResolvedValue({ success: true, data: { habilitada: true } });
  obterMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  atualizarMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  Object.defineProperty(window, 'ipcAPI', { value: { ...ipcApiOriginal, gdl: { ...ipcApiOriginal.gdl, obterPreferenciaListagem, obterMinhasRepsCache, atualizarMinhasRepsCache, onAvisosAlterados: () => () => undefined } }, writable: true });
});
afterEach(() => { vi.useRealTimers(); Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true }); });

describe('REPs do GDL no dashboard', () => {

  it('apenas lê o cache ao abrir e recebe alterações sem iniciar consultas de rede', async () => {
    vi.useFakeTimers();
    let notificar: (reiniciar: boolean) => void = () => undefined;
    const remover = vi.fn();
    window.ipcAPI.gdl.onAvisosAlterados = callback => { notificar = callback; return remover; };
    const { unmount } = render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await act(async () => undefined);
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: {
      ...snapshot, reps: [{ ...snapshot.reps[0], numero: '456' }],
    } });
    await act(async () => { notificar(false); });
    expect(screen.getByRole('button', { name: '456/2026' })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60_000); });
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    unmount();
    expect(remover).toHaveBeenCalledOnce();
  });

  it('não sobrepõe atualizações manuais enquanto aguarda a resposta do GDL', async () => {
    atualizarMinhasRepsCache.mockReturnValue(new Promise(() => undefined));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(atualizarMinhasRepsCache).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeDisabled();
  });

  it('não agenda atualização automática com a listagem desativada', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    await act(async () => { render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000); });
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
  });

  it('mostra o andamento da consulta sem esconder a lista salva', async () => {
    atualizarMinhasRepsCache.mockReturnValue(new Promise(() => undefined));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Natureza' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Designação de')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Designação até')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByText('Consultando GDL: 00:00')).toBeInTheDocument();
    expect(screen.queryByText(/O GDL pode levar alguns minutos/)).not.toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/).textContent).toMatch(/\d{2}:\d{2}$/);
    expect(screen.getByText('Aberta e Distribuída')).toHaveClass('bg-blue-100');
    expect(screen.getByRole('button', { name: /123\/2026/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Colunas' }).parentElement).toBe(
      screen.getByRole('button', { name: 'Atualizar' }).parentElement
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colunas' }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole('menuitemcheckbox', { name: 'fotos' })).toBeInTheDocument();
  });

  it('mostra o cache, permite atualizar e abre a REP selecionada no importador', async () => {
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(atualizarMinhasRepsCache).toHaveBeenCalledWith(true));
    fireEvent.click(screen.getByRole('button', { name: /123\/2026/ }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"pathname":"/reps"');
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"123"');
  });

  it('preserva a lista salva e avisa quando a rede ou VPN falha', async () => {
    atualizarMinhasRepsCache.mockResolvedValue({ success: false, falha: {
      codigo: 'rede', detalhes: 'fetch failed (ERR_CONNECTION_REFUSED)', referencia: '85be1fb5-d3c6-48fb-9cf0-f32b8b2dd97e',
    } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByText(/Não foi possível alcançar o GDL/)).toHaveTextContent('Exibindo a última lista salva.');
    expect(screen.queryByText(/ERR_CONNECTION_REFUSED/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }));
    expect(screen.getByText('Verifique a conexão e conecte a VPN, se necessária, antes de tentar novamente.')).toBeInTheDocument();
    expect(screen.queryByText(/ERR_CONNECTION_REFUSED/)).not.toBeInTheDocument();
    expect(screen.queryByText(/85be1fb5-d3c6-48fb-9cf0-f32b8b2dd97e/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /123\/2026/ })).toBeEnabled();
  });

  it('mostra só cache recente quando a listagem está desativada e bloqueia atualizar', async () => {
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, atualizadoEm: new Date(Date.now() - 29 * 60_000).toISOString() } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    expect(screen.getByText(/sem nova consulta/)).toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(screen.getByText(/Consulta da lista bloqueada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir API GDL' }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('gdl-config');
  });

  it('oculta cache de 30 minutos com a listagem desativada', async () => {
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, atualizadoEm: new Date(Date.now() - 30 * 60_000).toISOString() } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('Nenhuma lista recente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /123\/2026/ })).not.toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
  });

  it('ordena as colunas da lista e mantém o acesso à REP selecionada', async () => {
    const reps = [
      { ...snapshot.reps[0], idGdl: 1, numero: '20', dataDesignacao: '2026-10-03T10:00' },
      { ...snapshot.reps[0], idGdl: 2, numero: '3', dataDesignacao: '2026-10-01T10:00' },
      { ...snapshot.reps[0], idGdl: 3, numero: '11', dataDesignacao: '2026-10-02T10:00' },
    ];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    expect(await screen.findByText('3 REPs')).toHaveClass('bg-secondary');
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '11/2026', '3/2026',
    ]);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Crescente' }));
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '3/2026', '11/2026', '20/2026',
    ]);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Decrescente' }));
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '11/2026', '3/2026',
    ]);
    fireEvent.click(screen.getByRole('button', { name: '20/2026' }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"20"');
  });
  it('mostra REITERANDO junto à REP e ordena inicialmente pela designação mais recente', async () => {
    const reps = [
      { ...snapshot.reps[0], idGdl: 1, numero: '20', dataDesignacao: '2026-10-03T10:00', oficioReiterando: false },
      { ...snapshot.reps[0], idGdl: 2, numero: '3', dataDesignacao: '2026-10-01T10:00', oficioReiterando: true },
      { ...snapshot.reps[0], idGdl: 3, numero: '11', dataDesignacao: '2026-10-02T10:00', oficioReiterando: true },
    ];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    render(<MemoryRouter><TooltipProvider><GdlMinhasRepsDashboard /></TooltipProvider></MemoryRouter>);
    await screen.findByText('3 REPs');
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '11/2026', '3/2026',
    ]);
    const celula = screen.getByRole('button', { name: '11/2026' }).closest('td');
    if (!celula) throw new Error('Célula da REP não encontrada');
    expect(within(celula).getByText('REITERANDO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20/2026' }).closest('td')).not.toHaveTextContent('REITERANDO');
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    expect(screen.queryByRole('columnheader', { name: /Avisos/ })).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole('menuitem', { name: 'Ocultar' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Decrescente' }));
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '11/2026', '3/2026',
    ]);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colunas' }), { button: 0, ctrlKey: false });
    await screen.findByRole('menuitemcheckbox', { name: 'fotos' });
    expect(screen.queryByRole('menuitemcheckbox', { name: /numeroRep|prioridadeReiterando/ })).not.toBeInTheDocument();
  });

  it('memoriza ordenação e colunas visíveis ao reabrir o dashboard', async () => {
    const armazenamento = new Map<string, string>();
    vi.mocked(window.localStorage.getItem).mockImplementation(chave => armazenamento.get(chave) ?? null);
    vi.mocked(window.localStorage.setItem).mockImplementation((chave, valor) => { armazenamento.set(chave, valor); });
    const reps = [
      { ...snapshot.reps[0], idGdl: 1, numero: '20', dataDesignacao: '2026-10-03T10:00' },
      { ...snapshot.reps[0], idGdl: 2, numero: '3', dataDesignacao: '2026-10-01T10:00' },
    ];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    const { unmount } = render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('2 REPs');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Crescente' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colunas' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'fotos' }));
    unmount();
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('2 REPs');
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual(['3/2026', '20/2026']);
    expect(screen.queryByRole('columnheader', { name: 'Fotos' })).not.toBeInTheDocument();
  });

  it('ignora colunas removidas e impede ocultar o número ao restaurar preferências', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify({
      ordenacao: [{ id: 'prioridadeReiterando', desc: true }],
      visibilidade: { numeroRep: false, fotos: false, removida: true },
    }));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    expect(screen.getByRole('columnheader', { name: 'Nº REP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data de designação' })).toHaveTextContent('Data de designação');
    expect(screen.queryByRole('columnheader', { name: 'Fotos' })).not.toBeInTheDocument();
  });

  it('mantém somente a visualização compacta e ignora a preferência antiga', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('confortavel');
    const { container } = render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    expect(container.querySelector('[data-densidade]')).toHaveAttribute('data-densidade', 'compacta');
    expect(screen.queryByRole('combobox', { name: 'Densidade da lista' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem).not.toHaveBeenCalledWith('dashboard_gdl_densidade');
  });

  it('formata os números, os títulos e a data sem alterar os dados enviados ao importador', async () => {
    const reps = [{ ...snapshot.reps[0], numero: '109026' }, { ...snapshot.reps[0], idGdl: 9, numero: '93462' }];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    await screen.findByRole('button', { name: '109.026/2026' });
    expect(screen.getByRole('button', { name: '93.462/2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map(cabecalho => cabecalho.textContent)).toEqual([
      'Nº REP', 'Natureza do Exame', 'Data de designação', 'Fotos', 'Status',
    ]);
    expect(screen.getAllByText('01/10/2026 • 10:00')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '109.026/2026' }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"109026"');
  });

  it('mostra os avisos locais em snapshots antigos preservando a ordenação por data', async () => {
    const reps = [
      { ...snapshot.reps[0], idGdl: 1, numero: '20', dataDesignacao: '2026-10-03T10:00' },
      { ...snapshot.reps[0], idGdl: 2, numero: '3', dataDesignacao: '2026-10-01T10:00' },
    ];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    Object.assign(window.ipcAPI.gdl, {
      obterAvisosReiteracao: vi.fn().mockResolvedValue({ success: true, data: [
        { numero: '3', ano: '2026', reiterando: true, fonte: 'api', consultadoEm: '2026-10-16T12:00:00.000Z' },
      ] }),
      onAvisosAlterados: () => () => undefined,
    });
    render(<MemoryRouter><AvisosReiteracaoProvider><GdlMinhasRepsDashboard /></AvisosReiteracaoProvider></MemoryRouter>);
    await screen.findByText('REITERANDO');
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '3/2026',
    ]);
  });

});
