import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { GoogleDrivePage } from '@/pages/GoogleDrivePage';
import { TooltipProvider } from '@/components/ui/tooltip';

const estadoRapido = vi.fn();
const resumoCache = vi.fn();
const resumo = vi.fn();
const listarLaudosConcluidos = vi.fn();
const analisarRestauracao = vi.fn();
const confirmarRestauracao = vi.fn();
const onProgressoVerificacao = vi.fn(() => () => undefined);
const ipcApiOriginal = window.ipcAPI;

const estadoConectado = { conectado: true, email: 'perito@policiacientifica.pr.gov.br', envioAutomatico: false, pendencias: 0 };

beforeEach(() => {
  estadoRapido.mockReset().mockResolvedValue({
    success: true,
    data: { conectado: false, envioAutomatico: false, pendencias: 0 },
  });
  resumoCache.mockReset().mockResolvedValue({ success: true, data: null });
  resumo.mockReset().mockResolvedValue({ success: true, data: { estado: estadoConectado, copias: [], origem: 'drive' } });
  listarLaudosConcluidos.mockReset().mockResolvedValue({ success: true, data: [] });
  analisarRestauracao.mockReset();
  confirmarRestauracao.mockReset();
  onProgressoVerificacao.mockClear();
  window.ipcAPI = {
    ...ipcApiOriginal,
    googleDrive: {
      ...ipcApiOriginal.googleDrive,
      estadoRapido,
      resumoCache,
      resumo,
      listarLaudosConcluidos,
      analisarRestauracao,
      confirmarRestauracao,
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
    render(<MemoryRouter><TooltipProvider><GoogleDrivePage /></TooltipProvider></MemoryRouter>);

    expect(await screen.findByText('Manual durante a elaboração; automático ao concluir.')).toBeInTheDocument();
    expect(screen.queryByText('O envio manual e automático é habilitado somente para laudos concluídos.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explicação sobre os envios ao Google Drive' })).toBeInTheDocument();
  });

  it('exibe a lista cacheada antes da atualização remota', async () => {
    estadoRapido.mockResolvedValue({ success: true, data: estadoConectado });
    resumoCache.mockResolvedValue({
      success: true,
      data: {
        estado: estadoConectado,
        copias: [{ id: 'copia-1', laudoId: 'laudo-1', numeroRep: '123', nome: 'copia-cache.laWdo', tamanho: 1, modificadaEm: '2026-11-24T12:00:00.000Z', revisao: 'r1' }],
        atualizadoEm: '2026-11-24T12:00:00.000Z',
        origem: 'cache',
      },
    });
    resumo.mockImplementation(() => new Promise(() => undefined));

    render(<MemoryRouter><TooltipProvider><GoogleDrivePage /></TooltipProvider></MemoryRouter>);

    expect(await screen.findByText('copia-cache.laWdo')).toBeInTheDocument();
    expect(resumo).toHaveBeenCalledWith(true);
  });

  it('mostra carregamento sem cache e exibe vazio apenas após a consulta remota', async () => {
    let concluirResumo!: (resultado: unknown) => void;
    estadoRapido.mockResolvedValue({ success: true, data: estadoConectado });
    resumo.mockImplementation(() => new Promise(resolve => { concluirResumo = resolve; }));

    render(<MemoryRouter><TooltipProvider><GoogleDrivePage /></TooltipProvider></MemoryRouter>);

    expect(await screen.findByRole('status')).toHaveTextContent('Consultando cópias no Google Drive...');
    expect(screen.queryByText('Ainda não há cópias no Drive.')).not.toBeInTheDocument();

    await act(async () => {
      concluirResumo({ success: true, data: { estado: estadoConectado, copias: [], origem: 'drive' } });
    });

    expect(await screen.findByText('Ainda não há cópias no Drive.')).toBeInTheDocument();
  });

  it('resume a restauração com status, tamanho e ações do laudo recuperado', async () => {
    const copia = { id: 'copia-1', laudoId: 'laudo-1', numeroRep: '123', nome: 'copia.laWdo', tamanho: 1_572_864, modificadaEm: '2026-11-24T12:00:00.000Z', revisao: 'r1' };
    estadoRapido.mockResolvedValue({ success: true, data: estadoConectado });
    resumo.mockResolvedValue({ success: true, data: { estado: estadoConectado, copias: [copia], origem: 'drive' } });
    analisarRestauracao.mockResolvedValue({ success: true, data: { operacaoId: 'operacao-1', copiaId: copia.id, revisao: copia.revisao, previa: { numeroRep: copia.numeroRep, tipoExame: 'B-601', status: 'Concluído', figuras: 0, substituiRep: false, substituiLaudo: false } } });
    confirmarRestauracao.mockResolvedValue({ success: true, data: { laudoId: copia.laudoId } });

    render(<MemoryRouter><TooltipProvider><GoogleDrivePage /></TooltipProvider></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));

    expect(await screen.findByText('Restauração concluída')).toBeInTheDocument();
    expect(screen.getByText('Concluído')).toBeInTheDocument();
    expect(screen.getAllByText('1,5 MB')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Ver lista do status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir no editor' })).toBeInTheDocument();
  });
});
