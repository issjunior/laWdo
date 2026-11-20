import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndicadorGoogleDrive } from '@/components/layout/IndicadorGoogleDrive';

const googleDriveOriginal = window.ipcAPI.googleDrive;
const estadoRapido = vi.fn();
const estado = vi.fn();

beforeEach(() => {
  estadoRapido.mockReset().mockResolvedValue({
    success: true,
    data: { conectado: false, envioAutomatico: false, pendencias: 0 },
  });
  estado.mockReset().mockResolvedValue({
    success: true,
    data: { conectado: true, email: 'perito@policiacientifica.pr.gov.br', envioAutomatico: true, pendencias: 0 },
  });
  Object.assign(window.ipcAPI, {
    googleDrive: { ...googleDriveOriginal, estadoRapido, estado },
  });
});

afterEach(() => {
  cleanup();
  Object.assign(window.ipcAPI, { googleDrive: googleDriveOriginal });
});

describe('IndicadorGoogleDrive', () => {
  it('abre com o estado local em cache sem consultar o Google Drive', async () => {
    render(<MemoryRouter><IndicadorGoogleDrive /></MemoryRouter>);

    const botao = await screen.findByRole('button', { name: 'Drive: Google Drive não conectado' });
    fireEvent.click(botao);

    expect(await screen.findByRole('button', { name: 'Atualizar estado' })).toBeInTheDocument();
    expect(estado).not.toHaveBeenCalled();
  });

  it('atualiza sob demanda e reutiliza a operação pendente', async () => {
    let concluir!: (resposta: unknown) => void;
    estado.mockImplementationOnce(() => new Promise(resolver => { concluir = resolver; }));
    render(<MemoryRouter><IndicadorGoogleDrive /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Drive: Google Drive não conectado' }));
    const atualizar = await screen.findByRole('button', { name: 'Atualizar estado' });
    fireEvent.click(atualizar);
    fireEvent.click(atualizar);

    expect(estado).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Atualizando estado…')).toBeInTheDocument();

    await act(async () => {
      concluir({ success: true, data: { conectado: true, email: 'perito@policiacientifica.pr.gov.br', envioAutomatico: true, pendencias: 0 } });
    });
    expect(await screen.findByRole('button', { name: 'Drive: Google Drive conectado' })).toBeInTheDocument();
    expect(screen.getByText(/^Acesso:/)).toBeInTheDocument();
  });

  it('informa a falha manual e permite tentar novamente', async () => {
    estado.mockRejectedValueOnce(new Error('IPC indisponível'));
    render(<MemoryRouter><IndicadorGoogleDrive /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Drive: Google Drive não conectado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar estado' }));

    expect(await screen.findByText('Não foi possível confirmar o acesso ao Google Drive.')).toBeInTheDocument();
    expect(screen.queryByText('Atualizando estado…')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar estado' }));
    expect(await screen.findByRole('button', { name: 'Drive: Google Drive conectado' })).toBeInTheDocument();
  });

  it('atualiza o estado local ao recuperar o foco sem consultar o Google Drive', async () => {
    render(<MemoryRouter><IndicadorGoogleDrive /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Drive: Google Drive não conectado' });
    estadoRapido.mockResolvedValueOnce({ success: true, data: { conectado: true, envioAutomatico: true, pendencias: 2 } });

    fireEvent.focus(window);

    expect(await screen.findByRole('button', { name: 'Drive: Conta configurada localmente' })).toBeInTheDocument();
    expect(estado).not.toHaveBeenCalled();
  });
});
