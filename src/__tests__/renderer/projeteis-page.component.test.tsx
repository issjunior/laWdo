import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjeteisPage } from '@/pages/ProjeteisPage';

vi.mock('@shared/catalogos/projeteis.catalogo', () => ({
  catalogoProjeteis: Array.from({ length: 13 }, (_, indice) => ({
    id: `projetil-${indice + 1}`,
    calibre: `CAL-${String(indice + 1).padStart(2, '0')}`,
    tipo: 'ETOG',
    massaGramas: 8 + indice / 10,
    diametroMinMm: 9,
    diametroMaxMm: 9.02,
    comprimentoMinMm: indice === 11 ? null : 15.4,
    comprimentoMaxMm: indice === 11 ? null : 15.4,
    situacao: indice === 11 ? 'confirmada' : 'estimada',
  })),
}));

const ipcOriginal = window.ipcAPI;

describe('página de projéteis', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcOriginal,
        projetil: {
          listarPersonalizados: vi.fn().mockResolvedValue({ success: true, data: [] }),
        },
      },
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcOriginal, writable: true });
  });

  it('mostra três candidatos e expande a mesma ordem até dez', async () => {
    render(<ProjeteisPage />);
    await waitFor(() => expect(window.ipcAPI.projetil.listarPersonalizados).toHaveBeenCalled());
    expect(screen.queryByLabelText('Posição 1')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,0' } });
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(3);
    expect(screen.getByText('CAL-01')).toBeInTheDocument();
    expect(screen.queryByText('CAL-04')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais opções/ }));
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(10);
    expect(screen.getByText('CAL-10')).toBeInTheDocument();
    expect(screen.queryByText('CAL-11')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Posição 1').closest('div')).toHaveTextContent('CAL-01');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menos' }));
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(3);
  });

  it('mantém o catálogo oculto até abrir e filtra por calibre', async () => {
    render(<ProjeteisPage />);
    expect(screen.queryByText('Catálogo completo de projéteis')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver catálogo completo' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('13 variantes encontradas')).toBeInTheDocument();
    expect(within(dialogo).getByText('1 / 2')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Próxima' }));
    expect(within(dialogo).getByText('2 / 2')).toBeInTheDocument();
    expect(within(dialogo).getByText('CAL-13')).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('Calibre'), { target: { value: 'CAL-12' } });
    expect(within(dialogo).getByText('1 variante encontrada')).toBeInTheDocument();
    expect(within(dialogo).getByText('1 / 1')).toBeInTheDocument();
    expect(within(dialogo).getByText('CAL-12')).toBeInTheDocument();
    expect(within(dialogo).queryByText('CAL-01')).not.toBeInTheDocument();
  });

  it('filtra o catálogo por tipo, nível e presença das medidas', async () => {
    render(<ProjeteisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver catálogo completo' }));
    const dialogo = screen.getByRole('dialog');

    fireEvent.change(within(dialogo).getByLabelText('Tipo'), { target: { value: 'inexistente' } });
    expect(within(dialogo).getByText('0 variantes encontradas')).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('Tipo'), { target: { value: 'ETOG' } });

    fireEvent.click(within(dialogo).getByLabelText('Nível'));
    fireEvent.click(screen.getByRole('option', { name: 'Confirmada' }));
    expect(within(dialogo).getByText('1 variante encontrada')).toBeInTheDocument();
    expect(within(dialogo).getByText('CAL-12')).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByLabelText('Medidas'));
    fireEvent.click(screen.getByRole('option', { name: 'Diâmetro e comprimento' }));
    expect(within(dialogo).getByText('0 variantes encontradas')).toBeInTheDocument();
  });
});
