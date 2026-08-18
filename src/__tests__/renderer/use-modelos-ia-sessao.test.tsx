import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelosIaSessao } from '@/hooks/useModelosIaSessao';

describe('useModelosIaSessao', () => {
  beforeEach(() => {
    Object.assign(window.ipcAPI, {
      ia: {
        obterContexto: vi.fn().mockResolvedValue({
          success: true,
          data: { provedor: 'gemini', modelo: 'gemini-2.5-flash' },
        }),
        listarModelos: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { id: 'gemini-2.5-flash', rotulo: 'Gemini 2.5 Flash', disponibilidade: 'disponivel' },
            { id: 'entrada-invalida', disponibilidade: 'disponivel' },
          ],
        }),
      },
    });
  });

  it('normaliza o contexto e a disponibilidade retornados pelo IPC', async () => {
    const { result } = renderHook(() => useModelosIaSessao('laudo-190'));

    await waitFor(() => expect(result.current.modeloIaSessao).toBe('gemini-2.5-flash'));

    expect(result.current.provedorIaSessao).toBe('gemini');
    expect(result.current.modelosIaSessao).toEqual([
      { id: 'gemini-2.5-flash', rotulo: 'Gemini 2.5 Flash', disponibilidade: 'disponivel' },
    ]);
  });

  it('limpa a seleção ao sair do laudo', async () => {
    const { result, rerender } = renderHook(({ laudoId }) => useModelosIaSessao(laudoId), {
      initialProps: { laudoId: 'laudo-190' },
    });

    await waitFor(() => expect(result.current.modeloIaSessao).toBe('gemini-2.5-flash'));
    rerender({ laudoId: '' });

    expect(result.current.modeloIaSessao).toBeNull();
    expect(result.current.provedorIaSessao).toBeNull();
    expect(result.current.modelosIaSessao).toEqual([]);
  });
});
