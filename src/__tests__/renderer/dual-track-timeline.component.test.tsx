import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DualTrackTimeline } from '@/components/timeline/DualTrackTimeline';

const timelineRep = vi.fn();

describe('DualTrackTimeline', () => {
  beforeEach(() => {
    Object.assign(window.ipcAPI, { log: { timelineRep } });
  });

  it.each([
    ['sem eventos', [], { quantidadeEventos: 0, quantidadeEventosRep: 0, quantidadeEventosLaudo: 0 }],
    ['somente com eventos da REP', [{ id: 1, created_at: '2026-09-22T10:00:00.000Z', tipo_acao: 'criacao', modulo: 'rep', entidade: 'reps', acao: 'Criou REP', nivel: 'info', origem: 'REP' }], { quantidadeEventos: 1, quantidadeEventosRep: 1, quantidadeEventosLaudo: 0 }],
    ['com eventos de REP e laudo', [
      { id: 1, created_at: '2026-09-22T10:00:00.000Z', tipo_acao: 'criacao', modulo: 'rep', entidade: 'reps', acao: 'Criou REP', nivel: 'info', origem: 'REP' },
      { id: 2, created_at: '2026-09-22T10:01:00.000Z', tipo_acao: 'criacao', modulo: 'laudo', entidade: 'laudos', acao: 'Criou laudo', nivel: 'info', origem: 'Laudo' },
    ], { quantidadeEventos: 2, quantidadeEventosRep: 1, quantidadeEventosLaudo: 1 }],
  ])('informa resumo %s', async (_cenario, eventos, esperado) => {
    timelineRep.mockResolvedValue({ success: true, data: eventos });
    const onResumoAlterado = vi.fn();

    render(<DualTrackTimeline repId="rep-1" onResumoAlterado={onResumoAlterado} />);

    await waitFor(() => expect(onResumoAlterado).toHaveBeenLastCalledWith(esperado));
  });
});
