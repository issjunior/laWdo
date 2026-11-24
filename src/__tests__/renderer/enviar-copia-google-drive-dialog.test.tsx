import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnviarCopiaGoogleDriveDialog } from '@/components/google-drive/EnviarCopiaGoogleDriveDialog';

const googleDriveOriginal = window.ipcAPI.googleDrive;
const estadoRapido = vi.fn();
const enviarLaudo = vi.fn();

beforeEach(() => {
  estadoRapido.mockReset().mockResolvedValue({
    success: true,
    data: { conectado: true, envioAutomatico: false, pendencias: 0 },
  });
  enviarLaudo.mockReset();
  Object.assign(window.ipcAPI, {
    googleDrive: { ...googleDriveOriginal, estadoRapido, enviarLaudo },
  });
});

afterEach(() => {
  cleanup();
  Object.assign(window.ipcAPI, { googleDrive: googleDriveOriginal });
});

describe('EnviarCopiaGoogleDriveDialog', () => {
  it('apresenta a confirmação em um painel de segurança estruturado', async () => {
    render(<EnviarCopiaGoogleDriveDialog aberto laudoId="laudo-1" onAbertoChange={() => {}} />);

    expect(await screen.findByText('A cópia será cifrada antes de ser enviada para Meu Drive/laWdo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar cópia' })).toBeEnabled();
  });

  it('mostra o progresso indeterminado enquanto o envio está em andamento', async () => {
    enviarLaudo.mockImplementation(() => new Promise(() => undefined));
    render(<EnviarCopiaGoogleDriveDialog aberto laudoId="laudo-1" onAbertoChange={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Enviar cópia' }));

    expect(await screen.findByText('Preparando, cifrando, enviando e validando a cópia.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
  });
});
