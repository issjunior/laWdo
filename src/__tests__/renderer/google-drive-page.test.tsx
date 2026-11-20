import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDrivePage } from '@/pages/GoogleDrivePage';
import { TooltipProvider } from '@/components/ui/tooltip';

const estadoRapido = vi.fn();
const onProgressoVerificacao = vi.fn(() => () => undefined);
const ipcApiOriginal = window.ipcAPI;

beforeEach(() => {
  estadoRapido.mockReset().mockResolvedValue({
    success: true,
    data: { conectado: false, envioAutomatico: false, pendencias: 0 },
  });
  onProgressoVerificacao.mockClear();
  window.ipcAPI = {
    ...ipcApiOriginal,
    googleDrive: {
      ...ipcApiOriginal.googleDrive,
      estadoRapido,
      onProgressoVerificacao,
    },
  };
});

afterEach(() => {
  cleanup();
  window.ipcAPI = ipcApiOriginal;
});

describe('GoogleDrivePage', () => {
  it('explica que o envio manual pode ocorrer durante a elaboração', async () => {
    render(<TooltipProvider><GoogleDrivePage /></TooltipProvider>);

    expect(await screen.findByText('Manual durante a elaboração; automático ao concluir.')).toBeInTheDocument();
    expect(screen.queryByText('O envio manual e automático é habilitado somente para laudos concluídos.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explicação sobre os envios ao Google Drive' })).toBeInTheDocument();
  });
});
