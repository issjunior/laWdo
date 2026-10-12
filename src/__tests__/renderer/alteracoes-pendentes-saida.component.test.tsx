import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, Outlet, RouterProvider, useNavigate } from 'react-router';
import { useRef, useState } from 'react';
import { AlteracoesPendentesProvider, useRegistrarAlteracoesPendentes, useSolicitarSaida } from '@/contexts/AlteracoesPendentesContext';

let solicitarFechamento: (() => void) | undefined;
const confirmarFechamento = vi.fn(async () => undefined);
const cancelarFechamento = vi.fn(async () => undefined);
const logout = vi.fn();
const salvar = vi.fn<() => Promise<boolean>>();

function Edicao({ origem }: { origem: 'editor-laudo' | 'wizard-laudo-1' }) {
  const [conteudo, setConteudo] = useState('original');
  const conteudoRef = useRef(conteudo);
  conteudoRef.current = conteudo;
  const [referencia, setReferencia] = useState('original');
  const [erro, setErro] = useState<string | null>(null);
  const solicitarSaida = useSolicitarSaida();
  const navigate = useNavigate();
  const pendente = conteudo !== referencia;
  useRegistrarAlteracoesPendentes(origem, {
    pendente,
    salvando: false,
    verificar: () => conteudo !== referencia,
    salvar: async () => {
      const conteudoSalvo = conteudoRef.current;
      const resultado = await salvar();
      if (resultado) setReferencia(conteudoSalvo);
      else setErro('Falha ao salvar');
      return resultado && conteudoRef.current === conteudoSalvo;
    },
    erro: () => erro,
  });
  return <>
    <span>Conteúdo: {conteudo}</span>
    <button onClick={() => setConteudo('alterado')}>Alterar</button>
    <button onClick={() => { conteudoRef.current = 'alterado novamente'; setConteudo('alterado novamente'); }}>Alterar novamente</button>
    <Link to="/cabecalho">Cabeçalho</Link>
    <button onClick={() => navigate(-1)}>Histórico</button>
    <button onClick={() => solicitarSaida(() => setConteudo('lista'))}>Voltar</button>
    <button onClick={() => solicitarSaida(logout)}>Logout</button>
  </>;
}

function montar(origem: 'editor-laudo' | 'wizard-laudo-1' = 'editor-laudo') {
  const roteador = createMemoryRouter([
    { element: <AlteracoesPendentesProvider><Outlet /></AlteracoesPendentesProvider>, children: [
      { path: '/laudos', element: <Edicao origem={origem} /> },
      { path: '/cabecalho', element: <span>Página Cabeçalho</span> },
    ] },
  ], { initialEntries: ['/cabecalho', '/laudos'], initialIndex: 1 });
  render(<RouterProvider router={roteador} />);
  return roteador;
}

beforeEach(() => {
  solicitarFechamento = undefined;
  confirmarFechamento.mockClear();
  cancelarFechamento.mockClear();
  logout.mockClear();
  salvar.mockReset();
  salvar.mockResolvedValue(true);
  Object.assign(window.ipcAPI, {
    protegerFechamento: vi.fn(),
    onSolicitarFechamento: vi.fn((callback: () => void) => {
      solicitarFechamento = callback;
      return () => { solicitarFechamento = undefined; };
    }),
    confirmarFechamento,
    cancelarFechamento,
  });
});

describe.each(['editor-laudo', 'wizard-laudo-1'] as const)('saída com alterações em %s', origem => {
  it('cancela a troca de menu sem perder o conteúdo, depois permite descartar', async () => {
    const roteador = montar(origem);
    fireEvent.click(screen.getByText('Alterar'));
    fireEvent.click(screen.getByText('Cabeçalho'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continuar editando'));
    expect(roteador.state.location.pathname).toBe('/laudos');
    expect(screen.getByText('Conteúdo: alterado')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cabeçalho'));
    fireEvent.click(await screen.findByText('Sair sem salvar'));
    await waitFor(() => expect(roteador.state.location.pathname).toBe('/cabecalho'));
  });

  it('salva antes de seguir o destino original e mantém a tela em caso de falha', async () => {
    const roteador = montar(origem);
    salvar.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    fireEvent.click(screen.getByText('Alterar'));
    fireEvent.click(screen.getByText('Histórico'));
    fireEvent.click(await screen.findByText('Salvar e sair'));
    await screen.findByText('Não foi possível salvar todas as alterações. Tente novamente.');
    expect(roteador.state.location.pathname).toBe('/laudos');
    fireEvent.click(screen.getByText('Salvar e sair'));
    await waitFor(() => expect(roteador.state.location.pathname).toBe('/cabecalho'));
    expect(salvar).toHaveBeenCalledTimes(2);
  });

  it('protege Voltar, logout e fechamento da janela', async () => {
    montar(origem);
    fireEvent.click(screen.getByText('Alterar'));
    fireEvent.click(screen.getByText('Voltar'));
    fireEvent.click(await screen.findByText('Continuar editando'));
    expect(screen.getByText('Conteúdo: alterado')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Logout'));
    fireEvent.click(await screen.findByText('Continuar editando'));
    expect(logout).not.toHaveBeenCalled();
    act(() => solicitarFechamento?.());
    fireEvent.click(await screen.findByText('Salvar e sair'));
    await waitFor(() => expect(confirmarFechamento).toHaveBeenCalledTimes(1));
  });

  it('permite cancelar o fechamento e tentar novamente sem salvar', async () => {
    montar(origem);
    fireEvent.click(screen.getByText('Alterar'));
    act(() => solicitarFechamento?.());
    fireEvent.click(await screen.findByText('Continuar editando'));
    expect(cancelarFechamento).toHaveBeenCalledTimes(1);
    expect(confirmarFechamento).not.toHaveBeenCalled();
    act(() => solicitarFechamento?.());
    fireEvent.click(await screen.findByText('Sair sem salvar'));
    await waitFor(() => expect(confirmarFechamento).toHaveBeenCalledTimes(1));
  });

  it('sai diretamente quando o conteúdo está salvo', async () => {
    const roteador = montar(origem);
    fireEvent.click(screen.getByText('Cabeçalho'));
    await waitFor(() => expect(roteador.state.location.pathname).toBe('/cabecalho'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('mantém o aviso aberto se o conteúdo muda durante o salvamento e ignora cliques repetidos', async () => {
    montar(origem);
    let concluirSalvamento: ((valor: boolean) => void) | undefined;
    salvar.mockImplementation(() => new Promise(resolve => { concluirSalvamento = resolve; }));
    fireEvent.click(screen.getByText('Alterar'));
    fireEvent.click(screen.getByText('Cabeçalho'));
    fireEvent.click(await screen.findByText('Salvar e sair'));
    expect(screen.getByText('Salvando…')).toBeDisabled();
    fireEvent.click(screen.getByText('Salvando…'));
    expect(salvar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Alterar novamente'));
    await act(async () => { concluirSalvamento?.(true); });
    expect(screen.getByText('Conteúdo: alterado novamente')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
