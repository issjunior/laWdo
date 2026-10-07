import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  obterPreferenciaListagem.mockReset().mockResolvedValue({ success: true, data: { habilitada: true } });
  obterMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  atualizarMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  Object.defineProperty(window, 'ipcAPI', { value: { ...ipcApiOriginal, gdl: { ...ipcApiOriginal.gdl, obterPreferenciaListagem, obterMinhasRepsCache, atualizarMinhasRepsCache } }, writable: true });
});
afterEach(() => { Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true }); });

describe('REPs do GDL no dashboard', () => {
  it('mostra o andamento da consulta sem esconder a lista salva', async () => {
    atualizarMinhasRepsCache.mockReturnValue(new Promise(() => undefined));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Natureza' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Designação de')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Designação até')).not.toBeInTheDocument();
    expect(await screen.findByText('Consultando GDL: 00:00')).toBeInTheDocument();
    expect(screen.queryByText(/O GDL pode levar alguns minutos/)).not.toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/).textContent).toMatch(/\d{2}:\d{2}$/);
    expect(screen.getByText('Aberta e Distribuída')).toHaveClass('bg-blue-100');
    expect(screen.getByRole('button', { name: /REP 123\/2026/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Colunas' }).parentElement).toBe(
      screen.getByRole('button', { name: 'Atualizar' }).parentElement
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colunas' }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole('menuitemcheckbox', { name: 'fotos' })).toBeInTheDocument();
  });

  it('mostra o cache, permite atualizar e abre a REP selecionada no importador', async () => {
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    await waitFor(() => expect(atualizarMinhasRepsCache).toHaveBeenCalledWith(false));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(atualizarMinhasRepsCache).toHaveBeenCalledWith(true));
    fireEvent.click(screen.getByRole('button', { name: /REP 123\/2026/ }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"pathname":"/reps"');
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"123"');
  });

  it('preserva a lista salva e avisa quando a rede ou VPN falha', async () => {
    atualizarMinhasRepsCache.mockResolvedValue({ success: false, falha: {
      codigo: 'rede', detalhes: 'fetch failed (ERR_CONNECTION_REFUSED)', referencia: '85be1fb5-d3c6-48fb-9cf0-f32b8b2dd97e',
    } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    expect(await screen.findByText(/Não foi possível alcançar o GDL/)).toHaveTextContent('Exibindo a última lista salva.');
    expect(screen.queryByText(/ERR_CONNECTION_REFUSED/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }));
    expect(screen.getByText(/ERR_CONNECTION_REFUSED/)).toBeInTheDocument();
    expect(screen.getByText(/85be1fb5-d3c6-48fb-9cf0-f32b8b2dd97e/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /REP 123\/2026/ })).toBeEnabled();
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
    expect(screen.queryByRole('button', { name: /REP 123\/2026/ })).not.toBeInTheDocument();
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
    expect(screen.getAllByRole('button', { name: /^REP \d+\/2026$/ }).map(botao => botao.textContent)).toEqual([
      'REP 20/2026', 'REP 11/2026', 'REP 3/2026',
    ]);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Crescente' }));
    expect(screen.getAllByRole('button', { name: /^REP \d+\/2026$/ }).map(botao => botao.textContent)).toEqual([
      'REP 3/2026', 'REP 11/2026', 'REP 20/2026',
    ]);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Decrescente' }));
    expect(screen.getAllByRole('button', { name: /^REP \d+\/2026$/ }).map(botao => botao.textContent)).toEqual([
      'REP 20/2026', 'REP 11/2026', 'REP 3/2026',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'REP 20/2026' }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"20"');
  });
});
