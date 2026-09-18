import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Header } from '@/components/layout/Header';

const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => <button type="button">Menu</button> }));

describe('Header - atualizações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(window.ipcAPI, {
      getAppInfo: vi.fn().mockResolvedValue({ version: '0.1.12', name: 'laWdo', platform: 'win32', osVersion: 'Windows', arch: 'x64', memory: '8 GB', dbVersion: 1 }),
      atualizacao: {
        estado: vi.fn().mockResolvedValue({
          success: true,
          data: {
            estado: 'falhou',
            versaoInstalada: '0.1.12',
            falha: {
              codigo: 'REDE_INDISPONIVEL',
              etapa: 'verificacao',
              mensagem: 'O laWdo não conseguiu acessar o servidor de atualizações. A conexão pode estar indisponível ou o endereço pode estar bloqueado pela rede.',
              detalheTecnico: 'TypeError: fetch failed (ENOTFOUND)',
              ocorridoEm: '2026-09-18T12:00:00.000Z',
              acaoSugerida: 'verificar',
            },
          },
        }),
        verificar: vi.fn(),
        baixar: vi.fn(),
        adiar: vi.fn(),
        prepararReinicio: vi.fn(),
        instalarAgora: vi.fn(),
        agendar: vi.fn(),
        onProgresso: vi.fn().mockReturnValue(() => undefined),
        onSolicitarReinicio: vi.fn().mockReturnValue(() => undefined),
      },
    });
  });

  it('mostra um resumo amigável e preserva os detalhes técnicos recolhidos', async () => {
    render(<Header currentUser={null} onLogout={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Atualizações' }));

    expect(await screen.findByText('Falha na atualização')).toBeInTheDocument();
    expect(screen.getByText(/não conseguiu acessar o servidor de atualizações/i)).toBeInTheDocument();
    expect(screen.queryByText(/TypeError: fetch failed/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Ver detalhes técnicos'));

    expect(screen.getByText(/TypeError: fetch failed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar detalhes/i })).toBeInTheDocument();
  });
});
