import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndicadorConexaoGdl } from '@/components/layout/IndicadorConexaoGdl';
import { useConexaoGdl } from '@/hooks/useConexaoGdl';
import type { EstadoConexaoGdl } from '@shared/gdl/conexao';

const ipcOriginal = window.ipcAPI;
let estado: EstadoConexaoGdl;
let notificar: () => void;
const remover = vi.fn();
const obter = vi.fn();
const verificar = vi.fn();
let focada = true;
let visivel = true;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
  focada = true;
  visivel = true;
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focada);
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visivel ? 'visible' : 'hidden');
  estado = { ambiente: 'producao', revisao: 0, rede: 'acessivel', redeVerificadaEm: new Date().toISOString(),
    credenciais: 'validadas', credenciaisValidadasEm: '2026-10-23T12:00:00Z', web: 'desconhecida', verificando: false };
  obter.mockReset().mockImplementation(async () => ({ success: true, data: { ...estado } }));
  verificar.mockReset().mockImplementation(async () => {
    estado = { ...estado, rede: 'acessivel', redeVerificadaEm: new Date().toISOString() };
    return { success: true, data: { ...estado } };
  });
  remover.mockReset();
  Object.defineProperty(window, 'ipcAPI', { writable: true, value: {
    ...ipcOriginal, gdl: { obterEstadoConexao: obter, verificarConexao: verificar,
      onEstadoConexaoAlterado: (ouvinte: () => void) => { notificar = ouvinte; return remover; } },
  } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.defineProperty(window, 'ipcAPI', { value: ipcOriginal, writable: true });
});

describe('monitor no renderer', () => {
  it('verifica na entrada sem evidência e repete a cada 60 segundos', async () => {
    estado.rede = 'desconhecida';
    estado.redeVerificadaEm = null;
    renderHook(() => useConexaoGdl());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(verificar).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(verificar).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(verificar).toHaveBeenCalledTimes(2);
  });

  it('pausa fora de foco e verifica ao voltar somente quando necessário', async () => {
    renderHook(() => useConexaoGdl());
    await act(async () => undefined);
    await act(async () => { focada = false; fireEvent.blur(window); await vi.advanceTimersByTimeAsync(30_000); });
    await act(async () => { focada = true; fireEvent.focus(window); await vi.advanceTimersByTimeAsync(0); });
    expect(verificar).not.toHaveBeenCalled();
    await act(async () => { focada = false; fireEvent.blur(window); await vi.advanceTimersByTimeAsync(90_001); });
    expect(verificar).not.toHaveBeenCalled();
    await act(async () => { focada = true; fireEvent.focus(window); await vi.advanceTimersByTimeAsync(0); });
    expect(verificar).toHaveBeenCalledTimes(1);
  });

  it('não consulta minimizada e remove agendamento e assinatura ao sair', async () => {
    const { unmount } = renderHook(() => useConexaoGdl());
    await act(async () => undefined);
    await act(async () => { visivel = false; fireEvent(document, new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(180_000); });
    expect(verificar).not.toHaveBeenCalled();
    await act(async () => { visivel = true; fireEvent(document, new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); });
    expect(verificar).toHaveBeenCalledTimes(1);
    unmount();
    expect(remover).toHaveBeenCalledTimes(1);
    await act(async () => { notificar(); await vi.advanceTimersByTimeAsync(180_000); });
    expect(verificar).toHaveBeenCalledTimes(1);
  });

  it('não sobrepõe verificações e descarta resposta atrasada de ambiente anterior', async () => {
    const { result } = renderHook(() => useConexaoGdl());
    await act(async () => undefined);
    let concluir!: (resposta: unknown) => void;
    verificar.mockImplementationOnce(() => new Promise(resolver => { concluir = resolver; }));
    let pendente!: Promise<void>;
    act(() => { pendente = result.current.verificarAgora(); });
    await act(async () => { await result.current.verificarAgora(); });
    expect(verificar).toHaveBeenCalledTimes(1);
    estado = { ...estado, ambiente: 'homologacao', revisao: 1, credenciais: 'pendentes' };
    await act(async () => { notificar(); });
    await act(async () => {
      concluir({ success: true, data: { ...estado, ambiente: 'producao', revisao: 0 } });
      await pendente;
    });
    expect(result.current.estado?.ambiente).toBe('homologacao');
  });

  it('não aceita payload inválido e permite nova tentativa após falha de IPC', async () => {
    obter.mockResolvedValueOnce({ success: true, data: { ...estado, rede: 'inventada' } });
    const { result } = renderHook(() => useConexaoGdl());
    await act(async () => undefined);
    expect(result.current.estado).toBeNull();
    expect(result.current.erro).toContain('Não foi possível');
    verificar.mockRejectedValueOnce(new Error('IPC indisponível'));
    await act(async () => { await result.current.verificarAgora(); });
    expect(result.current.erro).toContain('Não foi possível');
    await act(async () => { await result.current.verificarAgora(); });
    expect(result.current.erro).toBeNull();
    expect(result.current.estado?.rede).toBe('acessivel');
  });
});

describe('indicador compacto', () => {
  const montar = () => render(<MemoryRouter><Routes>
    <Route path="/" element={<IndicadorConexaoGdl />} />
    <Route path="/gdl-config" element={<p>Página API GDL</p>} />
  </Routes></MemoryRouter>);

  it('mostra detalhes, validação anterior e ações sem bloquear a navegação', async () => {
    montar();
    await act(async () => undefined);
    const botao = screen.getByRole('button', { name: 'GDL: Acessível com credenciais validadas' });
    expect(botao).toHaveClass('w-16');
    expect(botao.querySelector('svg')).toHaveClass('dark:text-emerald-400');
    fireEvent.click(botao);
    expect(screen.getByRole('dialog', { name: 'Conexão com o GDL' })).toBeInTheDocument();
    expect(screen.getByText('Produção')).toBeInTheDocument();
    expect(screen.getByText('Validadas')).toBeInTheDocument();
    expect(screen.getByText(/A validação pode ser de um acesso anterior/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verificar agora' })); });
    expect(verificar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir API GDL' }));
    expect(screen.getByText('Página API GDL')).toBeInTheDocument();
    expect(remover).toHaveBeenCalled();
  });

  it('preserva aparência durante a checagem e sinaliza expiração sem depender apenas da cor', async () => {
    montar();
    await act(async () => undefined);
    estado.verificando = true;
    await act(async () => { notificar(); });
    expect(screen.getByRole('button', { name: 'GDL: Acessível com credenciais validadas' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^GDL:/ }));
    expect(screen.getByRole('button', { name: 'Verificar agora' })).toBeDisabled();
    expect(screen.getByText('Verificando a rede…')).toBeInTheDocument();
    await act(async () => { focada = false; fireEvent.blur(window); await vi.advanceTimersByTimeAsync(120_001); });
    expect(screen.getByRole('button', { name: 'GDL: Estado desconhecido ou desatualizado' })).toBeInTheDocument();
  });

  it.each([
    ['rejeitadas', 'acessivel', 'GDL: Acessível com pendências'],
    ['validadas', 'indisponivel', 'GDL: Indisponível na última verificação'],
  ] as const)('distingue credenciais %s e rede %s', async (credenciais, rede, nome) => {
    estado.credenciais = credenciais;
    estado.rede = rede;
    montar();
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
  });
});
