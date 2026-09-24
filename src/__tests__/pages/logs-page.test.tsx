import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogsPage } from '@/pages/LogsPage';

vi.mock('@/components/logs/CapturaLogsControle', () => ({ CapturaLogsControle: () => <div>Controle de captura</div> }));
vi.mock('@/components/logs/HistoricoCapturasLogs', () => ({ HistoricoCapturasLogs: () => null }));
vi.mock('@/components/data-table/data-table', () => ({ DataTable: () => <div>Tabela de resultados</div> }));
vi.mock('@/components/desempenho/DesempenhoTab', () => ({ DesempenhoTab: () => <div>Resumo dos eventos carregados</div> }));
vi.mock('@/components/timeline/DualTrackTimeline', () => ({
  DualTrackTimeline: ({ onResumoAlterado }: { onResumoAlterado?: (resumo: { quantidadeEventos: number; quantidadeEventosRep: number; quantidadeEventosLaudo: number }) => void }) => <button type="button" onClick={() => onResumoAlterado?.({ quantidadeEventos: 5, quantidadeEventosRep: 3, quantidadeEventosLaudo: 2 })}>Carregar resumo da linha do tempo</button>,
}));

const listar = vi.fn();
const listarAuditoria = vi.fn();
const contar = vi.fn();
const findByNumero = vi.fn();

describe('LogsPage', () => {
  beforeEach(() => {
    listar.mockResolvedValue({ success: true, data: [
      { timestamp: '2026-09-22T10:00:00.000Z', level: 'error', module: 'laudo', message: 'Falha' },
      { timestamp: '2026-09-22T10:01:00.000Z', level: 'info', module: 'sistema', message: 'Pronto' },
    ] });
    listarAuditoria.mockResolvedValue({ success: true, data: [{ id: 1, created_at: '2026-09-22T10:00:00.000Z', modulo: 'laudo', tipo_acao: 'atualizacao', nivel: 'info', acao: 'Atualizou laudo' }], total: 250 });
    contar.mockResolvedValue({ success: true, data: { sistema: 2, auditoria: 250 } });
    findByNumero.mockResolvedValue({ success: true, data: { id: 'rep-1', numero: '001/2026', status: 'Em Andamento' } });
    Object.assign(window.ipcAPI, {
      log: { listar, listarAuditoria, contar, limpar: vi.fn(), limparAuditoria: vi.fn(), timelineRep: vi.fn() },
      rep: { findByNumero },
    });
  });

  it('mostra somente o resumo do Sistema na aba Sistema', async () => {
    render(<LogsPage />);

    expect(await screen.findByRole('heading', { name: 'Logs e diagnóstico' })).toBeInTheDocument();
    expect(screen.getByText('Resumo do resultado atual')).toBeInTheDocument();
    expect(screen.getByText('Erros')).toBeInTheDocument();
    expect(screen.queryByText('Registros de auditoria carregados')).not.toBeInTheDocument();
  });

  it('distingue registros encontrados e carregados na Auditoria', async () => {
    render(<LogsPage />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Auditoria' }), { button: 0 });

    expect(await screen.findByText('Resumo da consulta')).toBeInTheDocument();
    expect(screen.getByText('Registros encontrados')).toBeInTheDocument();
    expect(screen.getByText('Registros carregados')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
  });

  it('mostra o resumo da REP selecionada e não oferece CSV na Linha do Tempo', async () => {
    render(<LogsPage />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Linha do Tempo' }), { button: 0 });
    fireEvent.change(screen.getByPlaceholderText('Ex: 045-2026'), { target: { value: '001/2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('Resumo da linha do tempo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar resumo da linha do tempo' }));
    expect(screen.getByText('Eventos da REP')).toBeInTheDocument();
    expect(screen.getByText('Eventos do laudo')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument();
  });
});
