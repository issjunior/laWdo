import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesempenhoTab } from '@/components/desempenho/DesempenhoTab';

vi.mock('@/components/logs/CapturaLogsControle', () => ({ CapturaLogsControle: () => <div>Controle de captura</div> }));
vi.mock('@/components/data-table/data-table', () => ({ DataTable: () => <div>Tabela de desempenho</div> }));

describe('DesempenhoTab', () => {
  beforeEach(() => {
    Object.assign(window.ipcAPI, {
      desempenho: {
        estado: vi.fn().mockResolvedValue({ success: true, data: { perfil: 'importante', sessao: null, eventosDescartados: 0 } }),
        listar: vi.fn().mockResolvedValue({ success: true, data: [
          { id: '1', sessaoId: 's', timestamp: '2026-09-22T10:00:00.000Z', perfil: 'importante', severidade: 'critico', origem: 'renderer', categoria: 'editor', evento: 'aplicar', operacao: 'aplicar_editor', canal: null, duracaoMs: 800, contextoId: null, metricas: {}, metadados: {} },
          { id: '2', sessaoId: 's', timestamp: '2026-09-22T10:01:00.000Z', perfil: 'importante', severidade: 'info', origem: 'renderer', categoria: 'editor', evento: 'salvar', operacao: 'salvar_editor', canal: null, duracaoMs: 100, contextoId: null, metricas: {}, metadados: {} },
          { id: '3', sessaoId: 's', timestamp: '2026-09-22T10:02:00.000Z', perfil: 'importante', severidade: 'importante', origem: 'renderer', categoria: 'editor', evento: 'exportar', operacao: 'exportar_editor', canal: null, duracaoMs: 500, contextoId: null, metricas: {}, metadados: {} },
        ] }),
        configurarPerfil: vi.fn(),
        exportarCsv: vi.fn(),
      },
    });
  });

  it('resume somente os eventos carregados', async () => {
    render(<DesempenhoTab />);

    expect(await screen.findByText('Resumo dos eventos carregados')).toBeInTheDocument();
    expect(screen.getByText('Eventos carregados')).toBeInTheDocument();
    expect(screen.getByText('Eventos críticos')).toBeInTheDocument();
    expect(screen.getByText('Operações lentas')).toBeInTheDocument();
    expect(screen.getByText('Maior duração')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('800 ms')).toBeInTheDocument();
  });
});
