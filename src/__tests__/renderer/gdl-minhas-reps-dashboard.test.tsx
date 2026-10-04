import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GdlMinhasRepsDashboard } from '@/components/rep/GdlMinhasRepsDashboard';

const ipcApiOriginal = window.ipcAPI;
const obterMinhasRepsCache = vi.fn();
const atualizarMinhasRepsCache = vi.fn();
const snapshot = { atualizadoEm: '2026-10-01T12:00:00.000Z', reps: [
  { idGdl: 8, numero: '123', ano: '2026', status: 'Aberta e Distribuída', naturezaExame: 'EXAME', naturezaExameComCodigo: 'B601 - EXAME', dataDesignacao: '2026-10-01T10:00', quantidadeFotos: 4 },
] };

function RotaAtual() {
  const local = useLocation();
  return <output data-testid="rota-atual">{JSON.stringify({ pathname: local.pathname, state: local.state })}</output>;
}

beforeEach(() => {
  obterMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  atualizarMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  Object.defineProperty(window, 'ipcAPI', { value: { ...ipcApiOriginal, gdl: { ...ipcApiOriginal.gdl, obterMinhasRepsCache, atualizarMinhasRepsCache } }, writable: true });
});
afterEach(() => { Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true }); });

describe('REPs do GDL no dashboard', () => {
  it('mostra o andamento da consulta sem esconder a lista salva', async () => {
    atualizarMinhasRepsCache.mockReturnValue(new Promise(() => undefined));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText(/1 de 1 REPs/)).toBeInTheDocument();
    expect(await screen.findByText('Consultando GDL: 00:00')).toBeInTheDocument();
    expect(screen.queryByText(/O GDL pode levar alguns minutos/)).not.toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/).textContent).toMatch(/\d{2}:\d{2}$/);
    expect(screen.getByText('Aberta e Distribuída')).toHaveClass('bg-blue-100');
    expect(screen.getByRole('button', { name: /REP 123\/2026/ })).toBeEnabled();
  });

  it('mostra o cache, permite atualizar e abre a REP selecionada no importador', async () => {
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    expect(await screen.findByText(/1 de 1 REPs/)).toBeInTheDocument();
    await waitFor(() => expect(atualizarMinhasRepsCache).toHaveBeenCalledWith(false));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(atualizarMinhasRepsCache).toHaveBeenCalledWith(true));
    fireEvent.click(screen.getByRole('button', { name: /REP 123\/2026/ }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"pathname":"/reps"');
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"123"');
  });

  it('preserva a lista salva e avisa quando a rede ou VPN falha', async () => {
    atualizarMinhasRepsCache.mockResolvedValue({ success: false, error: 'Rede indisponível' });
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText(/1 de 1 REPs/)).toBeInTheDocument();
    expect(await screen.findByText(/A lista salva pode estar desatualizada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /REP 123\/2026/ })).toBeEnabled();
  });
});
