import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjeteisPage } from '@/pages/ProjeteisPage';

vi.mock('@shared/catalogos/projeteis.catalogo', () => ({
  catalogoProjeteis: Array.from({ length: 13 }, (_, indice) => ({
    id: `projetil-${indice + 1}`, calibre: `CAL-${String(indice + 1).padStart(2, '0')}`,
    tipo: 'Encamisado total ogival', sigla: 'ETOG', massaGramas: 8 + indice / 10,
    calibreRealMinMm: 9, calibreRealMaxMm: 9.02, alturaMinMm: 15.4, alturaMaxMm: 15.4,
    situacao: 'estimada', fonte: 'tabela.pdf', localizacao: `linha ${indice + 1}`,
  })),
}));

const ipcOriginal = window.ipcAPI;

describe('página de projéteis', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'ipcAPI', { value: {
      ...ipcOriginal,
      projetil: { listarPersonalizados: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    }, writable: true });
  });

  afterAll(() => { Object.defineProperty(window, 'ipcAPI', { value: ipcOriginal, writable: true }); });

  it('mostra três resultados, expande até dez e explica a sigla', async () => {
    render(<ProjeteisPage />);
    await waitFor(() => expect(window.ipcAPI.projetil.listarPersonalizados).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,0' } });
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /ETOG: Encamisado total ogival/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais opções/ }));
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(10);
    expect(screen.getByText('CAL-10')).toBeInTheDocument();
  });

  it('filtra o catálogo por calibre nominal', () => {
    render(<ProjeteisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver catálogo completo' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('13 variantes encontradas')).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('Calibre nominal'), { target: { value: 'CAL-12' } });
    expect(within(dialogo).getByText('1 variante encontrada')).toBeInTheDocument();
    expect(within(dialogo).getByText('CAL-12')).toBeInTheDocument();
  });

  it('abre a tabela visual sem apagar a medida da consulta', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '9,01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar tabela em PDF' }));
    expect(screen.getByTitle('Tabela de calibres em PDF')).toHaveAttribute('src', expect.stringContaining('tabela-calibres-balistica-forense.pdf'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByLabelText('Calibre real médio (mm)')).toHaveValue('9,01');
  });
});
