import { IndicadorConexaoGdl } from '@/components/layout/IndicadorConexaoGdl';
import type { ReactNode } from 'react';
import type { RenderOptions } from '@testing-library/react';
import type { EstadoConexaoGdl } from '@shared/gdl/conexao';
import { ConexaoGdlProvider } from '@/contexts/ConexaoGdlContext';
import { act, fireEvent, render as renderOriginal, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosReiteracaoProvider } from '@/contexts/AvisosReiteracaoContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GdlMinhasRepsDashboard } from '@/components/rep/GdlMinhasRepsDashboard';

const ipcApiOriginal = window.ipcAPI;
const obterMinhasRepsCache = vi.fn();
const atualizarMinhasRepsCache = vi.fn();
const obterPreferenciaListagem = vi.fn();
const obterEstadoConexao = vi.fn();
let notificarConexao: (estado: EstadoConexaoGdl) => void;
const estadoConexao = { ambiente: 'producao', revisao: 0, versaoEstado: 0, rede: 'desconhecida', redeVerificadaEm: null,
  credenciais: 'pendentes', credenciaisValidadasEm: null, web: 'desconhecida', verificando: false };
const snapshot = { atualizadoEm: '2026-10-01T12:00:00.000Z', reps: [
  { idGdl: 8, numero: '123', ano: '2026', status: 'Aberta e Distribuída', naturezaExame: 'EXAME', naturezaExameComCodigo: 'B601 - EXAME', dataDesignacao: '2026-10-01T10:00', quantidadeFotos: 4 },
] };

function RotaAtual() {
  const local = useLocation();
  return <output data-testid="rota-atual">{JSON.stringify({ pathname: local.pathname, state: local.state })}</output>;
}

beforeEach(() => {
  vi.mocked(window.localStorage.getItem).mockReset().mockReturnValue(null);
  vi.mocked(window.localStorage.setItem).mockReset();
  HTMLElement.prototype.scrollIntoView = () => undefined;
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
  obterEstadoConexao.mockReset().mockResolvedValue({ success: true, data: estadoConexao });
  obterPreferenciaListagem.mockReset().mockResolvedValue({ success: true, data: { habilitada: true } });
  obterMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  atualizarMinhasRepsCache.mockReset().mockResolvedValue({ success: true, data: snapshot });
  Object.defineProperty(window, 'ipcAPI', { value: { ...ipcApiOriginal, gdl: { ...ipcApiOriginal.gdl, obterEstadoConexao, onEstadoConexaoAlterado: (callback: (estado: EstadoConexaoGdl) => void) => { notificarConexao = callback; return () => undefined; }, obterPreferenciaListagem, obterMinhasRepsCache, atualizarMinhasRepsCache, onAvisosAlterados: () => () => undefined } }, writable: true });
});
afterEach(() => { vi.useRealTimers(); Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true }); });

describe('REPs do GDL no dashboard', () => {
  it('propaga o sucesso e a falha da atualização para o header pelo mesmo snapshot', async () => {
    const sucesso: EstadoConexaoGdl = { ...estadoConexao, ambiente: 'producao', versaoEstado: 1,
      rede: 'acessivel', redeVerificadaEm: new Date(Date.now()).toISOString(), credenciais: 'pendentes', web: 'disponivel',
      acessoAutenticado: { origem: 'web', resultado: 'sucesso', realizadaEm: new Date(Date.now()).toISOString(), confirmadoEm: new Date(Date.now()).toISOString(), rejeicaoPendente: false } };
    atualizarMinhasRepsCache.mockImplementationOnce(async () => {
      notificarConexao(sucesso); return { success: true, data: snapshot };
    });
    render(<MemoryRouter><IndicadorConexaoGdl /><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByRole('button', { name: 'GDL: Acesso ao GDL confirmado' })).toBeInTheDocument();
    atualizarMinhasRepsCache.mockImplementationOnce(async () => {
      notificarConexao({ ...sucesso, versaoEstado: 2, acessoAutenticado: { ...sucesso.acessoAutenticado!, resultado: 'falha', motivo: 'estrutura' } });
      return { success: false, error: 'Formato inválido', falha: { codigo: 'estrutura', detalhes: 'Formato inválido' } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByRole('button', { name: 'GDL: Não foi possível recuperar dados do GDL' })).toBeInTheDocument();
    expect(obterEstadoConexao).toHaveBeenCalledTimes(1);
  });

  it.each(['ausentes', 'rejeitadas'])('orienta credenciais %s sem exibir a lista anterior', async credenciais => {
    obterEstadoConexao.mockResolvedValue({ success: true, data: { ...estadoConexao, credenciais } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    const aviso = credenciais === 'ausentes' ? /cadastre seu login, sua senha e seu CPF/ : /não aceitou as credenciais/;
    expect(await screen.findByText(aviso)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '123/2026' })).not.toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir API GDL' }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('/gdl-config');
  });

  it('orienta falha do acesso web sem afirmar que as credenciais foram rejeitadas', async () => {
    obterEstadoConexao.mockResolvedValue({ success: true, data: { ...estadoConexao, web: 'atencao', acessoAutenticado: { origem: 'web', resultado: 'falha', motivo: 'estrutura', realizadaEm: new Date(Date.now()).toISOString(), confirmadoEm: null, rejeicaoPendente: false } } });
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: null });
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText(/confira suas credenciais e execute o Teste de Rede/)).toBeInTheDocument();
    expect(screen.queryByText(/não aceitou as credenciais/)).not.toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
  });

  it('descarta uma atualização manual que terminou após excluir as credenciais', async () => {
    let notificar: (reiniciar: boolean) => void = () => undefined;
    window.ipcAPI.gdl.onAvisosAlterados = callback => { notificar = callback; return () => undefined; };
    let concluir: ((resposta: unknown) => void) | undefined;
    atualizarMinhasRepsCache.mockImplementation(() => new Promise(resolve => { concluir = resolve; }));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: null });
    obterEstadoConexao.mockResolvedValue({ success: true, data: { ...estadoConexao, revisao: 1, credenciais: 'ausentes' } });
    await act(async () => { notificar(true); notificarConexao({ ...estadoConexao, ambiente: 'producao', revisao: 1, versaoEstado: 1, rede: 'desconhecida', credenciais: 'ausentes', web: 'desconhecida' }); });
    await act(async () => { concluir?.({ success: true, data: snapshot }); });
    expect(screen.getByText(/cadastre seu login, sua senha e seu CPF/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '123/2026' })).not.toBeInTheDocument();
  });


  it('pagina em 20 e pesquisa no snapshot completo, incluindo REPs fora da primeira página', async () => {
    const reps = Array.from({ length: 25 }, (_, indice) => ({
      ...snapshot.reps[0], idGdl: indice + 1,
      numero: indice === 0 ? '999' : String(100 + indice),
      dataDesignacao: `2026-10-${String(indice + 1).padStart(2, '0')}T10:00`,
    }));
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('25 REPs')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^\d+\/2026$/ })).toHaveLength(20);
    expect(screen.queryByRole('button', { name: '999/2026' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Itens por página' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByRole('button', { name: '999/2026' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar REP' }), { target: { value: '999/2026' } });
    expect(screen.getByRole('button', { name: '999/2026' })).toBeInTheDocument();
    expect(screen.getByText('Pág 1 de 1')).toBeInTheDocument();
    expect(screen.getByText('1 registro(s)')).toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
  });

  it('apenas lê o cache ao abrir e recebe alterações sem iniciar consultas de rede', async () => {
    vi.useFakeTimers();
    let notificar: (reiniciar: boolean) => void = () => undefined;
    const remover = vi.fn();
    window.ipcAPI.gdl.onAvisosAlterados = callback => { notificar = callback; return remover; };
    const { unmount } = render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await act(async () => undefined);
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: {
      ...snapshot, reps: [{ ...snapshot.reps[0], numero: '456' }],
    } });
    await act(async () => { notificar(false); });
    expect(screen.getByRole('button', { name: '456/2026' })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60_000); });
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    unmount();
    expect(remover).toHaveBeenCalledOnce();
  });

  it('não sobrepõe atualizações manuais enquanto aguarda a resposta do GDL', async () => {
    atualizarMinhasRepsCache.mockReturnValue(new Promise(() => undefined));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(atualizarMinhasRepsCache).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeDisabled();
  });

  it('permite duas atualizações manuais consecutivas sem aguardar a validade do cache', async () => {
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    const botao = screen.getByRole('button', { name: 'Atualizar' });
    fireEvent.click(botao);
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await waitFor(() => expect(atualizarMinhasRepsCache).toHaveBeenCalledTimes(2));
    expect(atualizarMinhasRepsCache).toHaveBeenNthCalledWith(1, true);
    expect(atualizarMinhasRepsCache).toHaveBeenNthCalledWith(2, true);
  });

  it('não agenda atualização automática com a listagem desativada', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    await act(async () => { render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000); });
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
  });

  it('mostra o andamento da consulta sem esconder a lista salva', async () => {
    atualizarMinhasRepsCache.mockReturnValue(new Promise(() => undefined));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Natureza' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Designação de')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Designação até')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByText('Consultando GDL: 00:00')).toBeInTheDocument();
    expect(screen.queryByText(/O GDL pode levar alguns minutos/)).not.toBeInTheDocument();
    expect(screen.getByText(/Atualizado em/).textContent).toMatch(/\d{2}:\d{2}$/);
    expect(screen.getByText('Aberta e Distribuída')).toHaveClass('bg-blue-100');
    expect(screen.getByRole('button', { name: /123\/2026/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Colunas' }).parentElement).toBe(
      screen.getByRole('button', { name: 'Atualizar' }).parentElement
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colunas' }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole('menuitemcheckbox', { name: 'fotos' })).toBeInTheDocument();
  });

  it('mostra o cache, permite atualizar e abre a REP selecionada no importador', async () => {
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(atualizarMinhasRepsCache).toHaveBeenCalledWith(true));
    fireEvent.click(screen.getByRole('button', { name: /123\/2026/ }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"pathname":"/reps"');
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"123"');
  });

  it('preserva a lista salva e informa o requisito da rede institucional', async () => {
    atualizarMinhasRepsCache.mockResolvedValue({ success: false, falha: {
      codigo: 'rede', condicaoEsperada: 'acesso_rede_institucional', codigoSistema: 'ERR_CONNECTION_REFUSED', etapa: 'rede_gdl', detalhes: 'Servidor inacessível', referencia: '85be1fb5-d3c6-48fb-9cf0-f32b8b2dd97e',
    } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('1 REP')).toHaveClass('bg-secondary');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Exibindo a última lista salva.'));
    expect(screen.queryByText(/ERR_CONNECTION_REFUSED/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }));
    expect(screen.getByRole('status')).toHaveTextContent('rede da Polícia Científica do Paraná');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/ERR_CONNECTION_REFUSED/)).toHaveTextContent('85be1fb5-d3c6-48fb-9cf0-f32b8b2dd97e');
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: snapshot });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /123\/2026/ })).toBeEnabled();

    expect(screen.getByRole('button', { name: /123\/2026/ })).toBeEnabled();
  });

  it('substitui o cache recente pela orientação quando a listagem está desativada', async () => {
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, atualizadoEm: new Date(Date.now() - 29 * 60_000).toISOString() } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    expect(await screen.findByText(/Para visualizar suas REPs/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '123/2026' })).not.toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir API GDL' }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('gdl-config');
  });

  it('volta à orientação ao receber a desativação e reapresenta o cache ao reativar', async () => {
    let notificar: (reiniciar: boolean) => void = () => undefined;
    window.ipcAPI.gdl.onAvisosAlterados = callback => { notificar = callback; return () => undefined; };
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: '123/2026' })).toBeEnabled();
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    await act(async () => { notificar(true); });
    expect(screen.getByText(/Para visualizar suas REPs/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '123/2026' })).not.toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: true } });
    await act(async () => { notificar(true); });
    expect(screen.getByRole('button', { name: '123/2026' })).toBeEnabled();
    expect(screen.queryByText(/Para visualizar suas REPs/)).not.toBeInTheDocument();
  });

  it('oculta cache de 30 minutos com a listagem desativada', async () => {
    obterPreferenciaListagem.mockResolvedValue({ success: true, data: { habilitada: false } });
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, atualizadoEm: new Date(Date.now() - 30 * 60_000).toISOString() } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    expect(await screen.findByText('Nenhuma lista recente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /123\/2026/ })).not.toBeInTheDocument();
    expect(atualizarMinhasRepsCache).not.toHaveBeenCalled();
  });

  it('ordena as colunas da lista e mantém o acesso à REP selecionada', async () => {
    const reps = [
      { ...snapshot.reps[0], idGdl: 1, numero: '20', dataDesignacao: '2026-10-03T10:00' },
      { ...snapshot.reps[0], idGdl: 2, numero: '3', dataDesignacao: '2026-10-01T10:00' },
      { ...snapshot.reps[0], idGdl: 3, numero: '11', dataDesignacao: '2026-10-02T10:00' },
    ];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    expect(await screen.findByText('3 REPs')).toHaveClass('bg-secondary');
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '11/2026', '3/2026',
    ]);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Crescente' }));
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '3/2026', '11/2026', '20/2026',
    ]);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Decrescente' }));
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '11/2026', '3/2026',
    ]);
    fireEvent.click(screen.getByRole('button', { name: '20/2026' }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"20"');
  });
  it('mostra REITERANDO junto à REP e ordena inicialmente pela designação mais recente', async () => {
    const reps = [
      { ...snapshot.reps[0], idGdl: 1, numero: '20', dataDesignacao: '2026-10-03T10:00', oficioReiterando: false },
      { ...snapshot.reps[0], idGdl: 2, numero: '3', dataDesignacao: '2026-10-01T10:00', oficioReiterando: true },
      { ...snapshot.reps[0], idGdl: 3, numero: '11', dataDesignacao: '2026-10-02T10:00', oficioReiterando: true },
    ];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    render(<MemoryRouter><TooltipProvider><GdlMinhasRepsDashboard /></TooltipProvider></MemoryRouter>);
    await screen.findByText('3 REPs');
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '11/2026', '3/2026',
    ]);
    const celula = screen.getByRole('button', { name: '11/2026' }).closest('td');
    if (!celula) throw new Error('Célula da REP não encontrada');
    expect(within(celula).getByText('REITERANDO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20/2026' }).closest('td')).not.toHaveTextContent('REITERANDO');
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    expect(screen.queryByRole('columnheader', { name: /Avisos/ })).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole('menuitem', { name: 'Ocultar' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Decrescente' }));
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '11/2026', '3/2026',
    ]);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colunas' }), { button: 0, ctrlKey: false });
    await screen.findByRole('menuitemcheckbox', { name: 'fotos' });
    expect(screen.queryByRole('menuitemcheckbox', { name: /numeroRep|prioridadeReiterando/ })).not.toBeInTheDocument();
  });

  it('memoriza ordenação e colunas visíveis ao reabrir o dashboard', async () => {
    const armazenamento = new Map<string, string>();
    vi.mocked(window.localStorage.getItem).mockImplementation(chave => armazenamento.get(chave) ?? null);
    vi.mocked(window.localStorage.setItem).mockImplementation((chave, valor) => { armazenamento.set(chave, valor); });
    const reps = [
      { ...snapshot.reps[0], idGdl: 1, numero: '20', dataDesignacao: '2026-10-03T10:00' },
      { ...snapshot.reps[0], idGdl: 2, numero: '3', dataDesignacao: '2026-10-01T10:00' },
    ];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    const { unmount } = render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('2 REPs');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nº REP' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Crescente' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colunas' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'fotos' }));
    unmount();
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('2 REPs');
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual(['3/2026', '20/2026']);
    expect(screen.queryByRole('columnheader', { name: 'Fotos' })).not.toBeInTheDocument();
  });

  it('ignora colunas removidas e impede ocultar o número ao restaurar preferências', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify({
      ordenacao: [{ id: 'prioridadeReiterando', desc: true }],
      visibilidade: { numeroRep: false, fotos: false, removida: true },
    }));
    render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    expect(screen.getByRole('columnheader', { name: 'Nº REP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data de designação' })).toHaveTextContent('Data de designação');
    expect(screen.queryByRole('columnheader', { name: 'Fotos' })).not.toBeInTheDocument();
  });

  it('mantém somente a visualização compacta e ignora a preferência antiga', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('confortavel');
    const { container } = render(<MemoryRouter><GdlMinhasRepsDashboard /></MemoryRouter>);
    await screen.findByText('1 REP');
    expect(container.querySelector('[data-densidade]')).toHaveAttribute('data-densidade', 'compacta');
    expect(screen.queryByRole('combobox', { name: 'Densidade da lista' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem).not.toHaveBeenCalledWith('dashboard_gdl_densidade');
  });

  it('formata os números, os títulos e a data sem alterar os dados enviados ao importador', async () => {
    const reps = [{ ...snapshot.reps[0], numero: '109026' }, { ...snapshot.reps[0], idGdl: 9, numero: '93462' }];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    render(<MemoryRouter><GdlMinhasRepsDashboard /><RotaAtual /></MemoryRouter>);
    await screen.findByRole('button', { name: '109.026/2026' });
    expect(screen.getByRole('button', { name: '93.462/2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map(cabecalho => cabecalho.textContent)).toEqual([
      'Nº REP', 'Natureza do Exame', 'Data de designação', 'Fotos', 'Status',
    ]);
    expect(screen.getAllByText('01/10/2026 • 10:00')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '109.026/2026' }));
    expect(screen.getByTestId('rota-atual')).toHaveTextContent('"numero":"109026"');
  });

  it('mostra os avisos locais em snapshots antigos preservando a ordenação por data', async () => {
    const reps = [
      { ...snapshot.reps[0], idGdl: 1, numero: '20', dataDesignacao: '2026-10-03T10:00' },
      { ...snapshot.reps[0], idGdl: 2, numero: '3', dataDesignacao: '2026-10-01T10:00' },
    ];
    obterMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    atualizarMinhasRepsCache.mockResolvedValue({ success: true, data: { ...snapshot, reps } });
    Object.assign(window.ipcAPI.gdl, {
      obterAvisosReiteracao: vi.fn().mockResolvedValue({ success: true, data: [
        { numero: '3', ano: '2026', reiterando: true, fonte: 'api', consultadoEm: '2026-10-16T12:00:00.000Z' },
      ] }),
      onAvisosAlterados: () => () => undefined,
    });
    render(<MemoryRouter><AvisosReiteracaoProvider><GdlMinhasRepsDashboard /></AvisosReiteracaoProvider></MemoryRouter>);
    await screen.findByText('REITERANDO');
    expect(screen.getAllByRole('button', { name: /^\d[\d.]*\/2026$/ }).map(botao => botao.textContent)).toEqual([
      '20/2026', '3/2026',
    ]);
  });

});

const render = (ui: ReactNode, opcoes?: RenderOptions) => renderOriginal(<ConexaoGdlProvider>{ui}</ConexaoGdlProvider>, opcoes);
