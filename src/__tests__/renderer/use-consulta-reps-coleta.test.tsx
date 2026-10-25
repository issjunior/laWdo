import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useConsultaRepsColeta } from '@/hooks/useConsultaRepsColeta';
import { esquemaRepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso';

const original = window.ipcAPI;
const referencias = esquemaRepsMesmoCasoGdl.parse({ ambiente: 'producao', numeroRep: '100', anoRep: '2026', numeroCaso: '42', consultadoEm: new Date().toISOString(), reps: [] });
afterEach(() => { window.ipcAPI = original; });
function configurar(consultar: ReturnType<typeof vi.fn>) {
  Object.defineProperty(window, 'ipcAPI', { writable: true, value: { ...original, gdl: { ...original.gdl, consultarRepsMesmoCaso: consultar } } });
}

it('consulta uma vez após preparar o editor, inclusive em StrictMode, sem repetir por renderização', async () => {
  const consultar = vi.fn().mockResolvedValue({ success: true, data: referencias }); configurar(consultar);
  const aplicar = vi.fn(); const falhar = vi.fn();
  const { rerender } = renderHook(({ pronta }) => useConsultaRepsColeta({ laudoId: 'laudo-abertura', sessao: 1, habilitada: pronta, aoAplicar: aplicar, aoFalhar: falhar }), { initialProps: { pronta: false }, wrapper: StrictMode });
  expect(consultar).not.toHaveBeenCalled();
  rerender({ pronta: true });
  await waitFor(() => expect(aplicar).toHaveBeenCalledWith(referencias));
  rerender({ pronta: true });
  expect(consultar).toHaveBeenCalledTimes(1); expect(falhar).not.toHaveBeenCalled();
});

it('descarta resposta atrasada ao trocar de laudo e aplica somente a resposta atual', async () => {
  let concluir: (valor: unknown) => void = () => undefined;
  const consultar = vi.fn().mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; })).mockResolvedValue({ success: true, data: referencias }); configurar(consultar);
  const aplicar = vi.fn(); const falhar = vi.fn();
  const { rerender } = renderHook(({ id, sessao }) => useConsultaRepsColeta({ laudoId: id, sessao, habilitada: true, aoAplicar: aplicar, aoFalhar: falhar }), { initialProps: { id: 'laudo-antigo', sessao: 1 } });
  rerender({ id: 'laudo-atual', sessao: 2 });
  await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(1));
  await act(async () => { concluir({ success: true, data: referencias }); });
  expect(aplicar).toHaveBeenCalledTimes(1); expect(falhar).not.toHaveBeenCalled();
});

it('não repete uma falha silenciosa e tenta novamente ao reabrir ou concluir Atualizar REP', async () => {
  const consultar = vi.fn().mockResolvedValueOnce({ success: false, error: 'net::ERR_NAME_NOT_RESOLVED' }).mockResolvedValue({ success: true, data: referencias }); configurar(consultar);
  const aplicar = vi.fn(); const falhar = vi.fn();
  const { rerender } = renderHook(({ sessao }) => useConsultaRepsColeta({ laudoId: 'laudo-vpn', sessao, habilitada: true, aoAplicar: aplicar, aoFalhar: falhar }), { initialProps: { sessao: 1 } });
  await waitFor(() => expect(falhar).toHaveBeenCalledTimes(1));
  expect(aplicar).not.toHaveBeenCalled();
  rerender({ sessao: 1 }); expect(consultar).toHaveBeenCalledTimes(1);
  rerender({ sessao: 2 });
  await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(1));
  expect(consultar).toHaveBeenCalledTimes(2);
});

it('não aplica resposta após desmontar o editor', async () => {
  let concluir: (valor: unknown) => void = () => undefined;
  const consultar = vi.fn().mockImplementation(() => new Promise(resolve => { concluir = resolve; })); configurar(consultar);
  const aplicar = vi.fn(); const falhar = vi.fn();
  const { unmount } = renderHook(() => useConsultaRepsColeta({ laudoId: 'laudo-fechado', sessao: 1, habilitada: true, aoAplicar: aplicar, aoFalhar: falhar }));
  unmount(); await act(async () => { concluir({ success: true, data: referencias }); });
  expect(aplicar).not.toHaveBeenCalled(); expect(falhar).not.toHaveBeenCalled();
});
