import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndicadorGoogleDrive } from '@/components/layout/IndicadorGoogleDrive';

const googleDriveOriginal = window.ipcAPI.googleDrive;
const estadoRapido = vi.fn();
const abrirPasta = vi.fn();

beforeEach(() => {
  estadoRapido.mockReset().mockResolvedValue({
    success: true,
    data: { conectado: true, email: 'perito@policiacientifica.pr.gov.br', envioAutomatico: false, pendencias: 0 },
  });
  abrirPasta.mockReset().mockResolvedValue({ success: true });
  Object.assign(window.ipcAPI, {
    googleDrive: { ...googleDriveOriginal, estadoRapido, abrirPasta },
  });
});

afterEach(() => {
  cleanup();
  Object.assign(window.ipcAPI, { googleDrive: googleDriveOriginal });
});

describe('IndicadorGoogleDrive', () => {
  it('separa a configuração da abertura da pasta no navegador', async () => {
    render(<MemoryRouter><IndicadorGoogleDrive /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Drive: Conta configurada localmente' }));

    expect(await screen.findByRole('button', { name: 'Configuração' })).toBeInTheDocument();
    expect(screen.getByText('perito@policiacientifica.pr.gov.br')).toHaveClass('break-all');
    expect(screen.getByText('Acesso ainda não confirmado')).toBeInTheDocument();
    expect(screen.getByText('Pendências: 0 · automático: desativado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Google Drive' }));
    expect(abrirPasta).toHaveBeenCalledTimes(1);
  });
});
