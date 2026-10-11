import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssistenteIaCard } from '@/components/ai/AssistenteIaCard';
import { DialogoAplicarRespostaIa } from '@/components/ai/DialogoAplicarRespostaIa';
import {
  BarraEditorLaudo,
  CabecalhoEditorLaudo,
  RodapeEditorLaudo,
} from '@/components/laudo/editor/ControlesEditorLaudo';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAtalhoSalvarLaudo } from '@/hooks/useAtalhoSalvarLaudo';
import { useGerenciadorAlteracoesLaudo } from '@/hooks/useGerenciadorAlteracoesLaudo';
import { DialogoSaidaLaudo } from '@/components/laudo/editor/DialogoSaidaLaudo';

function HarnessAtalhoSalvar({
  bloqueado = false,
  onSalvar,
}: {
  bloqueado?: boolean;
  onSalvar: () => void;
}) {
  useAtalhoSalvarLaudo({ ativo: true, bloqueado, onSalvar });
  return null;
}

describe('layout do editor de laudo', () => {
  it('estabelece a referência depois que o editor normaliza o carregamento', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());
    act(() => result.current.iniciarSessao('<p style="color:red">Texto</p>', true));
    const sessao = result.current.obterSessao();
    const carregado = '<p style="color: red;">Texto</p>';
    act(() => {
      expect(result.current.iniciarSalvamento()).toBe(false);
      expect(result.current.atualizarConteudo(carregado)).toBe(false);
      result.current.concluirInicializacao(carregado, sessao);
    });
    expect(result.current.inicializando).toBe(false);
    act(() => expect(result.current.atualizarConteudo(carregado)).toBe(false));
    act(() => result.current.atualizarConteudo('<p>Novo texto</p>'));
    expect(result.current.alteracoesPendentes).toBe(true);
    act(() => result.current.concluirInicializacao('<p>Novo texto</p>', sessao));
    expect(result.current.alteracoesPendentes).toBe(true);
    act(() => result.current.atualizarConteudo(carregado));
    expect(result.current.alteracoesPendentes).toBe(false);
  });

  it('não absorve uma edição do usuário feita antes de concluir a inicialização', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());
    act(() => result.current.iniciarSessao('original', true));
    const sessao = result.current.obterSessao();
    act(() => {
      result.current.registrarAlteracao('usuario');
      result.current.atualizarConteudo('editado');
      result.current.concluirInicializacao('editado', sessao);
    });
    expect(result.current.alteracoesPendentes).toBe(true);
  });
  it('foca a opção segura e mantém o modal aberto ao iniciar salvamento', async () => {
    const aoSalvar = vi.fn();
    const aoAlterarAbertura = vi.fn();
    const { rerender } = render(
      <DialogoSaidaLaudo aberto salvando={false} erro={null} aoAlterarAbertura={aoAlterarAbertura} aoDescartar={vi.fn()} aoSalvar={aoSalvar} />,
    );

    expect(await screen.findByRole('button', { name: 'Continuar editando' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e sair' }));
    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(aoAlterarAbertura).not.toHaveBeenCalled();

    rerender(<DialogoSaidaLaudo aberto salvando erro="Falha ao salvar" aoAlterarAbertura={aoAlterarAbertura} aoDescartar={vi.fn()} aoSalvar={aoSalvar} />);
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sair sem salvar' })).toBeDisabled();
    expect(screen.getByText('Falha ao salvar')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aoAlterarAbertura).not.toHaveBeenCalled();

    rerender(<DialogoSaidaLaudo aberto salvando={false} erro="Falha ao salvar" aoAlterarAbertura={aoAlterarAbertura} aoDescartar={vi.fn()} aoSalvar={aoSalvar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e sair' }));
    expect(aoSalvar).toHaveBeenCalledTimes(2);
  });

  it('permite Escape para continuar editando', async () => {
    const aoAlterarAbertura = vi.fn();
    render(<DialogoSaidaLaudo aberto salvando={false} erro={null} aoAlterarAbertura={aoAlterarAbertura} aoDescartar={vi.fn()} aoSalvar={vi.fn()} />);
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aoAlterarAbertura).toHaveBeenCalledWith(false);
  });
  it('hierarquiza visualização, exportação e salvamento no cabeçalho', () => {
    const onIrAoFinal = vi.fn();
    render(
      <CabecalhoEditorLaudo
        repNumero="192/2026"
        nomeEnvolvido="João da Silva"
        estadoSalvamento="pendente"
        operacaoEmAndamento={false}
        carregandoPreview={false}
        exportando={false}
        libreOfficeDisponivel
        onVoltar={vi.fn()}
        onIrAoFinal={onIrAoFinal}
        onVisualizar={vi.fn()}
        onExportar={vi.fn()}
        onSalvar={vi.fn()}
      />,
    );

    const visualizar = screen.getByRole('button', { name: 'Visualizar' });
    const exportar = screen.getByRole('button', { name: /Exportar/ });
    const salvar = screen.getByRole('button', { name: 'Salvar' });

    const tituloRep = screen.getByText('REP 192/2026');
    const cabecalho = tituloRep.closest('header');

    expect(tituloRep).toHaveClass('font-bold', 'text-primary');
    expect(cabecalho).toHaveClass('-mt-6', 'py-2');
    expect(cabecalho).not.toHaveClass('sticky', 'top-0');
    fireEvent.click(screen.getByRole('button', { name: 'Ir ao final' }));
    expect(onIrAoFinal).toHaveBeenCalledTimes(1);
    expect(visualizar.compareDocumentPosition(exportar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(exportar.compareDocumentPosition(salvar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(salvar).toHaveClass('bg-primary');
  });

  it('expõe as preferências acessíveis e as ações do menu de placeholders', async () => {
    const onModoConteudoChange = vi.fn();
    const onModoOrganizacaoChange = vi.fn();
    const onAbrirIndicePlaceholders = vi.fn();

    render(
      <TooltipProvider>
        <BarraEditorLaudo
          modoConteudo="dados"
          modoOrganizacao="single"
          onModoConteudoChange={onModoConteudoChange}
          onModoOrganizacaoChange={onModoOrganizacaoChange}
          onAbrirIndicePlaceholders={onAbrirIndicePlaceholders}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole('group', { name: 'Conteúdo exibido' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Organização' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dados da REP/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Documento único/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Opções de placeholders' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Exibir chaves no documento' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Opções de placeholders' }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ver índice de placeholders' }));
    fireEvent.click(screen.getByRole('button', { name: /Por seções/ }));

    expect(onModoConteudoChange).toHaveBeenCalledWith('chaves');
    expect(onAbrirIndicePlaceholders).toHaveBeenCalledTimes(1);
    expect(onModoOrganizacaoChange).toHaveBeenCalledWith('multi');
  });

  it('mantém o assistente recolhido e abre comandos somente sob demanda', async () => {
    const onOpenSheet = vi.fn();
    const onRevisarOrtografia = vi.fn();

    render(
      <AssistenteIaCard
        secaoIndex={0}
        secaoTitulo="DO OBJETO DA PERÍCIA"
        htmlContent="<p>Conteúdo pericial.</p>"
        onRevisarOrtografia={onRevisarOrtografia}
        onAdequarEscrita={vi.fn()}
        onDescreverImagem={vi.fn()}
        onPerguntar={vi.fn()}
        onOpenSheet={onOpenSheet}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Revisar ortografia' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Assistente IA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar ortografia' }));

    await waitFor(() => {
      expect(onOpenSheet).toHaveBeenCalledWith(0, 'DO OBJETO DA PERÍCIA');
      expect(onRevisarOrtografia).toHaveBeenCalledWith('<p>Conteúdo pericial.</p>', 0);
    });
  });

  it('exige confirmação explícita antes de substituir a seção', () => {
    const onConfirmar = vi.fn();
    const onAlterarFragmento = vi.fn();
    render(
      <DialogoAplicarRespostaIa
        open
        secaoTitulo="CONCLUSÃO"
        conteudoAtual="Texto atual"
        conteudoProposto="Texto revisado"
        fragmentosPropostos={[{ id: 'texto-0', texto: 'Texto revisado' }]}
        onOpenChange={vi.fn()}
        onConfirmar={onConfirmar}
        onAlterarFragmento={onAlterarFragmento}
      />,
    );

    expect(screen.getByText(/substituirá todo o conteúdo de “CONCLUSÃO”/)).toBeInTheDocument();
    expect(screen.getByText('Texto atual')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Texto revisado')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Texto proposto texto-0' }), {
      target: { value: 'Texto ajustado' },
    });
    expect(onAlterarFragmento).toHaveBeenCalledWith('texto-0', 'Texto ajustado');

    fireEvent.click(screen.getByRole('button', { name: 'Substituir seção' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it('repete somente Voltar e Salvar no encerramento do fluxo', () => {
    const onVoltarAoTopo = vi.fn();
    render(
      <RodapeEditorLaudo
        estadoSalvamento="salvo"
        operacaoEmAndamento={false}
        onVoltar={vi.fn()}
        onVoltarAoTopo={onVoltarAoTopo}
        onSalvar={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Voltar para laudos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao topo' }));
    expect(onVoltarAoTopo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Salvar laudo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
  });

  it('compara o conteúdo atual com a versão salva, inclusive após desfazer', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());

    act(() => {
      result.current.iniciarSessao('<p>Original</p>');
      result.current.registrarAlteracao('normalizacao-inicial');
    });
    expect(result.current.estadoSalvamento).toBe('salvo');

    act(() => result.current.atualizarConteudo('<p>Editado</p>'));
    expect(result.current.estadoSalvamento).toBe('pendente');

    act(() => result.current.atualizarConteudo('<p>Original</p>'));
    expect(result.current.alteracoesPendentes).toBe(false);

    act(() => result.current.atualizarConteudo('<p>Editado</p>'));
    expect(result.current.alteracoesPendentes).toBe(true);
  });

  it('impede salvamentos concorrentes e preserva mudanças feitas durante o salvamento', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());

    act(() => result.current.iniciarSessao('original'));
    act(() => {
      expect(result.current.iniciarSalvamento()).toBe(true);
      expect(result.current.iniciarSalvamento()).toBe(false);
      expect(result.current.estaSalvando()).toBe(true);
      result.current.atualizarConteudo('nova edição');
      result.current.concluirSalvamento('salvo', 'nova edição', result.current.obterSessao());
    });

    expect(result.current.estadoSalvamento).toBe('pendente');
    expect(result.current.estaSalvando()).toBe(false);
  });

  it('ignora a conclusão de uma sessão anterior', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());
    act(() => result.current.iniciarSessao('primeiro'));
    const sessaoAnterior = result.current.obterSessao();
    act(() => result.current.iniciarSessao('segundo'));
    act(() => result.current.concluirSalvamento('primeiro', 'primeiro', sessaoAnterior));
    expect(result.current.estadoSalvamento).toBe('salvo');
    expect(result.current.atualizarConteudo('segundo')).toBe(false);
  });

  it('mantém a pendência após falha e permite nova tentativa de salvar', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());
    act(() => result.current.iniciarSessao('original'));
    act(() => result.current.atualizarConteudo('alterado'));
    const sessao = result.current.obterSessao();

    act(() => {
      expect(result.current.iniciarSalvamento()).toBe(true);
      result.current.falharSalvamento(sessao);
    });
    expect(result.current.estadoSalvamento).toBe('erro');
    expect(result.current.alteracoesPendentes).toBe(true);

    act(() => {
      expect(result.current.iniciarSalvamento()).toBe(true);
      result.current.concluirSalvamento('alterado', 'alterado', sessao);
    });
    expect(result.current.alteracoesPendentes).toBe(false);
  });

  it('não marca pendência após um evento tardio sem diferença no conteúdo', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());
    act(() => result.current.iniciarSessao('original'));
    const sessao = result.current.obterSessao();
    act(() => {
      result.current.iniciarSalvamento();
      result.current.concluirSalvamento('salvo', 'salvo', sessao);
      result.current.registrarAlteracao();
      result.current.atualizarConteudo('salvo');
    });
    expect(result.current.alteracoesPendentes).toBe(false);
  });

  it('salva com Ctrl+S e bloqueia o atalho durante outra operação', () => {
    const onSalvar = vi.fn();
    const { rerender } = render(<HarnessAtalhoSalvar onSalvar={onSalvar} />);

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(onSalvar).toHaveBeenCalledTimes(1);

    rerender(<HarnessAtalhoSalvar bloqueado onSalvar={onSalvar} />);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(onSalvar).toHaveBeenCalledTimes(1);
  });
});
