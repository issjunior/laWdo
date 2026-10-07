import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GdlMinhasRepsModal } from '@/components/rep/GdlMinhasRepsModal';
import type { MinhaRepGdl } from '@shared/types/gdl-minhas-reps.types';

const ipcApiOriginal = window.ipcAPI;
const obterMinhasRepsCache = vi.fn();
const atualizarMinhasRepsCache = vi.fn();
const obterPreferenciaListagem = vi.fn();
const onSelecionar = vi.fn();
const reps: MinhaRepGdl[] = [
  { idGdl: 1, numero: '134358', ano: '2025', status: 'Aberta e Distribuída', naturezaExame: 'EXAME DE CONSTATAÇÃO', naturezaExameComCodigo: 'B601 - EXAME DE CONSTATAÇÃO', dataDesignacao: '2025-12-31T10:20', quantidadeFotos: 4 },
  { idGdl: 2, numero: '7', ano: '2026', status: 'Laudo em Execução', naturezaExame: 'EXAME DE EFICIÊNCIA', naturezaExameComCodigo: 'B602 - EXAME DE EFICIÊNCIA', dataDesignacao: '2026-01-01T09:00', quantidadeFotos: 0 },
];
const snapshot = { reps, atualizadoEm: '2026-01-01T12:00:00.000Z' };

beforeEach(() => {
  obterPreferenciaListagem.mockReset().mockResolvedValue({ success: true, data: { habilitada: true } });
  obterMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: null });
  atualizarMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  onSelecionar.mockReset();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  HTMLElement.prototype.scrollIntoView = () => undefined;
  Object.defineProperty(window, 'ipcAPI', {
    value: { ...ipcApiOriginal, gdl: { ...ipcApiOriginal.gdl, obterPreferenciaListagem, obterMinhasRepsCache, atualizarMinhasRepsCache } }, writable: true,
  });
});

afterEach(() => { Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true }); });

function abrirModal() {
  render(<GdlMinhasRepsModal open onOpenChange={vi.fn()} onSelecionar={onSelecionar} onConfigurarCredenciais={vi.fn()} />);
}

describe('modal Minhas REPs do GDL com cache compartilhado', () => {
  it('exibe cache recente sem consultar GDL quando a listagem está desativada', async () => {
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, atualizadoEm: new Date(Date.now() - 29 * 60_000).toISOString() } });
    abrirModal();
    expect(await screen.findByText(/2 de 2 REPs/)).toBeInTheDocument();
    expect(screen.getByText(/sem nova consulta/)).toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByText(/Consulta da lista bloqueada/)).toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
  });

  it('oculta cache com 30 minutos quando a listagem está desativada', async () => {
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, atualizadoEm: new Date(Date.now() - 30 * 60_000).toISOString() } });
    abrirModal();
    expect(await screen.findByText(/Não há lista salva recente/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /REP 134.358\/2025/ })).not.toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
  });
  it('mantém o andamento visível enquanto atualiza uma lista salva', async () => {
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: snapshot });
    atualizarMinhasRepsCache.mockReturnValue(new Promise(() => undefined));
    abrirModal();
    expect(await screen.findByText(/2 de 2 REPs/)).toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/).textContent).toMatch(/Atualizado em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
    expect(screen.getByText('Consultando GDL: 00:00')).toBeInTheDocument();
    expect(screen.queryByText(/O GDL pode levar alguns minutos/)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /REP 134.358\/2025/ })).toBeEnabled();
  });

  it('filtra a lista completa e abre a importação selecionada', async () => {
    abrirModal();
    expect(await screen.findByText(/2 de 2 REPs/)).toBeInTheDocument();
    expect(atualizarMinhasRepsCache).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Aberta e Distribuída' }));
    expect(screen.getByText(/1 de 2 REPs/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    fireEvent.click(screen.getByRole('radio', { name: /REP 134.358\/2025/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar selecionada' }));
    expect(onSelecionar).toHaveBeenCalledWith(reps[0]);
  });

  it('mostra o cache se a atualização falhar e permite atualização manual', async () => {
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: snapshot });
    atualizarMinhasRepsCache.mockResolvedValueOnce({ success: false, falha: {
      codigo: 'autenticacao', detalhes: 'Login web não concluído.', referencia: '95327f98-48ad-41fd-8f89-0e94e97e67ce',
    } })
      .mockResolvedValueOnce({ success: true, data: snapshot });
    abrirModal();
    expect(await screen.findByText(/O GDL não concluiu a autenticação/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configurar GDL' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }));
    expect(screen.getByText('Login web não concluído.')).toBeInTheDocument();
    expect(screen.getByText(/2 de 2 REPs/)).toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(atualizarMinhasRepsCache).toHaveBeenCalledWith(true));
  });
});
