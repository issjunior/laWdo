import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { LaudosPage } from '@/pages/LaudosPage';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/ui/sidebar', () => ({ useSidebar: () => ({ setTemporariamenteRecolhida: recolher }) }));
const recolher = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/AlteracoesPendentesContext', () => ({ useSolicitarSaida: () => vi.fn(), useRegistrarAlteracoesPendentes: vi.fn() }));

const excluir = vi.fn();
const listar = vi.fn();
beforeEach(() => {
  excluir.mockReset().mockResolvedValue({ success: true, message: 'Laudo removido' });
  listar.mockReset().mockResolvedValue({ success: true, data: [{ id: 'laudo', rep_id: 'rep', rep_numero: '123/2026', status: 'Em andamento', data_inicio: '2026-10-28' }] });
  const vazio = vi.fn().mockResolvedValue({ success: true, data: [] });
  const ouvir = () => vi.fn();
  Object.assign(window.ipcAPI, {
    laudo: { findAll: listar, delete: excluir, verificarLibreOffice: vi.fn().mockResolvedValue({ success: true, data: false }) },
    categoria: { findAll: vazio }, placeholder: { findAll: vazio },
    ia: { onProgresso: ouvir, onProgressoConsulta: ouvir, onPainelPronto: ouvir, onPainelComando: ouvir,
      onPainelReencaixar: ouvir, onPainelFechado: ouvir, painelFechar: vi.fn() },
  });
});

describe('exclusão do laudo na listagem', () => {
  it('publica toast após sucesso, fecha o diálogo e atualiza a lista', async () => {
    render(<MemoryRouter><TooltipProvider><LaudosPage /></TooltipProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir laudo da REP 123/2026' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir Laudo' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledExactlyOnceWith('Laudo removido'));
    expect(excluir).toHaveBeenCalledExactlyOnceWith('laudo', undefined);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('não publica sucesso nem fecha a confirmação quando a exclusão falha', async () => {
    excluir.mockResolvedValue({ success: false, error: 'Falha ao excluir' });
    render(<MemoryRouter><TooltipProvider><LaudosPage /></TooltipProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir laudo da REP 123/2026' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir Laudo' }));
    await screen.findByText('Falha ao excluir');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(listar).toHaveBeenCalledTimes(1);
  });
});
