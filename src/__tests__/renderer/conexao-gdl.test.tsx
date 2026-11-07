import type { ReactNode } from 'react';
import type { RenderOptions } from '@testing-library/react';
import { ConexaoGdlProvider } from '@/contexts/ConexaoGdlContext';
import { act, cleanup, fireEvent, render as renderOriginal, renderHook as renderHookOriginal, screen } from '@testing-library/react';
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
  estado = { ambiente: 'producao', revisao: 0, versaoEstado: 0, rede: 'acessivel', redeVerificadaEm: new Date().toISOString(),
    credenciais: 'validadas', credenciaisValidadasEm: '2026-10-23T12:00:00Z', web: 'desconhecida', verificando: false, acessoAutenticado: { origem: 'api', resultado: 'sucesso', realizadaEm: new Date().toISOString(), confirmadoEm: new Date().toISOString(), rejeicaoPendente: false } };
  obter.mockReset().mockImplementation(async () => ({ success: true, data: { ...estado } }));
  verificar.mockReset().mockImplementation(async () => {
    estado = { ...estado, rede: 'acessivel', redeVerificadaEm: new Date().toISOString() };
    return { success: true, data: { ...estado } };
  });
  remover.mockReset();
  Object.defineProperty(window, 'ipcAPI', { writable: true, value: {
    ...ipcOriginal, gdl: { obterEstadoConexao: obter, verificarConexao: verificar,
      onEstadoConexaoAlterado: (ouvinte: (estado: EstadoConexaoGdl) => void) => { notificar = () => ouvinte({ ...estado }); return remover; } },
  } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.defineProperty(window, 'ipcAPI', { value: ipcOriginal, writable: true });
});

describe('monitor no renderer', () => {
  it('compartilha uma assinatura e uma leitura entre consumidores e aplica o evento sem IPC extra', async () => {
    const { result } = renderHookOriginal(() => [useConexaoGdl(), useConexaoGdl()], { wrapper: ConexaoGdlProvider });
    await act(async () => undefined);
    expect(obter).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe(result.current[1]);
    estado = { ...estado, versaoEstado: 3, acessoAutenticado: { origem: 'web', resultado: 'falha', motivo: 'estrutura', realizadaEm: new Date().toISOString(), confirmadoEm: null, rejeicaoPendente: false } };
    await act(async () => { notificar(); });
    expect(result.current[0].resumo.aparencia).toBe('atencao');
    expect(result.current[1].resumo).toBe(result.current[0].resumo);
    expect(obter).toHaveBeenCalledTimes(1);
    estado = { ...estado, versaoEstado: 2, acessoAutenticado: null };
    await act(async () => { notificar(); });
    expect(result.current[0].estado?.versaoEstado).toBe(3);
  });

  it('verifica na entrada sem evidência e repete a cada 60 segundos', async () => {
    estado.rede = 'desconhecida';
    estado.redeVerificadaEm = null;
    estado.acessoAutenticado = null;
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
    let segunda!: Promise<void>;
    act(() => { segunda = result.current.verificarAgora(); });
    expect(segunda).toBe(pendente);
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

  it('mostra uma única mensagem e ações sem detalhes técnicos nem bloquear a navegação', async () => {
    montar();
    await act(async () => undefined);
    const botao = screen.getByRole('button', { name: 'GDL: Acesso ao GDL confirmado' });
    expect(botao).toHaveClass('w-16');
    expect(botao.querySelector('svg')).toHaveClass('dark:text-emerald-400');
    fireEvent.click(botao);
    expect(screen.getByRole('dialog', { name: 'Conexão com o GDL' })).toBeInTheDocument();
    expect(screen.getByText('Acesso ao GDL confirmado')).toBeInTheDocument();
    for (const texto of ['Produção', 'Credenciais da API', 'Validação pendente', 'Acesso web', 'Última checagem de rede']) {
      expect(screen.queryByText(texto)).not.toBeInTheDocument();
    }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Testar Conexão' })); });
    expect(verificar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar GDL' }));
    expect(screen.getByText('Página API GDL')).toBeInTheDocument();
    expect(remover).not.toHaveBeenCalled();
  });

  it('preserva aparência durante a checagem e após vários minutos fora de foco', async () => {
    montar();
    await act(async () => undefined);
    estado.verificando = true;
    await act(async () => { notificar(); });
    expect(screen.getByRole('button', { name: 'GDL: Acesso ao GDL confirmado' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^GDL:/ }));
    expect(screen.getByRole('button', { name: 'Testar Conexão' })).toBeDisabled();
    expect(screen.getByText('Testando conexão…')).toBeInTheDocument();
    await act(async () => { focada = false; fireEvent.blur(window); await vi.advanceTimersByTimeAsync(120_001); });
    expect(screen.getByRole('button', { name: 'GDL: Acesso ao GDL confirmado' })).toBeInTheDocument();
  });

  it('aplica a recuperação de rede recebida por evento sem depender do dashboard', async () => {
    estado = { ...estado, rede: 'indisponivel', acessoAutenticado: {
      origem: 'web', resultado: 'falha', motivo: 'rede', realizadaEm: new Date().toISOString(),
      confirmadoEm: null, rejeicaoPendente: false,
    } };
    montar();
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: 'GDL: Não foi possível recuperar dados do GDL' })).toBeInTheDocument();
    vi.advanceTimersByTime(1);
    estado = { ...estado, versaoEstado: 1, rede: 'acessivel', redeVerificadaEm: new Date().toISOString() };
    await act(async () => { notificar(); });
    const botao = screen.getByRole('button', { name: 'GDL: Conexão disponível' });
    expect(botao.querySelector('svg')).toHaveClass('dark:text-sky-400');
    expect(obter).toHaveBeenCalledTimes(1);
    expect(verificar).not.toHaveBeenCalled();
  });

  it.each([
    ['rejeitadas', 'acessivel', 'GDL: Confira suas credenciais'],
    ['validadas', 'indisponivel', 'GDL: Não foi possível conectar ao GDL'],
  ] as const)('distingue credenciais %s e rede %s', async (credenciais, rede, nome) => {
    estado.credenciais = credenciais;
    estado.rede = rede;
    if (credenciais === 'rejeitadas') estado.acessoAutenticado = { origem: 'api', resultado: 'rejeitada', realizadaEm: new Date().toISOString(), confirmadoEm: null, rejeicaoPendente: true };
    montar();
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
  });
  it.each([
    ['ausentes', null, 'Configure seu acesso ao GDL'],
    ['pendentes', null, 'Conexão disponível'],
  ] as const)('não confunde credenciais %s com indisponibilidade', async (credenciais, acessoAutenticado, mensagem) => {
    estado = { ...estado, credenciais, acessoAutenticado };
    montar();
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: `GDL: ${mensagem}` }));
    expect(screen.getByText(mensagem)).toBeInTheDocument();
    expect(screen.queryByText('Validação pendente')).not.toBeInTheDocument();
  });

  it('confirma a listagem com API pendente e mostra somente o aviso de ambiente de testes', async () => {
    estado.ambiente = 'homologacao';
    estado.credenciais = 'pendentes';
    estado.acessoAutenticado = { origem: 'web', resultado: 'sucesso', realizadaEm: new Date().toISOString(), confirmadoEm: new Date().toISOString(), rejeicaoPendente: false };
    montar();
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'GDL: Acesso ao GDL confirmado' }));
    expect(screen.getByText('Ambiente de testes')).toBeInTheDocument();
    expect(screen.queryByText('Homologação')).not.toBeInTheDocument();
  });

  it('mostra resultado, horário e duração e permite testar novamente sem aguardar o monitor', async () => {
    verificar.mockImplementation(async () => {
      estado = { ...estado, versaoEstado: estado.versaoEstado + 1,
        ultimoTesteRede: { sucesso: true, verificadoEm: new Date(Date.now()).toISOString(), duracaoMs: 218 } };
      return { success: true, data: estado };
    });
    montar();
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('button', { name: /^GDL:/ }));
    const testar = screen.getByRole('button', { name: 'Testar Conexão' });
    await act(async () => { fireEvent.click(testar); });
    expect(screen.getByRole('status')).toHaveTextContent('Rede acessível');
    expect(screen.getByRole('status')).toHaveTextContent('218 ms');
    expect(screen.getByRole('status')).toHaveTextContent(new Date(Date.now()).toLocaleTimeString('pt-BR'));
    expect(testar).toBeEnabled();
    await act(async () => { fireEvent.click(testar); });
    expect(verificar).toHaveBeenCalledTimes(2);
    estado = { ...estado, versaoEstado: estado.versaoEstado + 1, rede: 'indisponivel',
      acessoAutenticado: null, ultimoTesteRede: { sucesso: false, verificadoEm: new Date(Date.now()).toISOString(), duracaoMs: 5000 } };
    await act(async () => { notificar(); });
    expect(screen.getByRole('status')).toHaveTextContent('Não foi possível confirmar o acesso pela rede');
    expect(screen.getByRole('status')).toHaveTextContent('5000 ms');
    expect(screen.getByRole('button', { name: 'GDL: Não foi possível conectar ao GDL' })).toBeInTheDocument();
  });

  it('mantém a confirmação com testes automáticos de rede e sem consulta de REPs', async () => {
    montar();
    await act(async () => undefined);
    await act(async () => { await vi.advanceTimersByTimeAsync(120_001); });
    expect(screen.getByRole('button', { name: 'GDL: Acesso ao GDL confirmado' })).toBeInTheDocument();
    expect(estado.acessoAutenticado?.confirmadoEm).toBe('2026-10-24T12:00:00.000Z');
  });

});

const render = (ui: ReactNode, opcoes?: RenderOptions) => renderOriginal(<ConexaoGdlProvider>{ui}</ConexaoGdlProvider>, opcoes);
const renderHook = (_hook: () => ReturnType<typeof useConexaoGdl>) => renderHookOriginal(_hook, { wrapper: ConexaoGdlProvider });
