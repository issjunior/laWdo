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
  it('hierarquiza visualização, exportação e salvamento no cabeçalho', () => {
    const onIrAoFinal = vi.fn();
    render(
      <CabecalhoEditorLaudo
        repNumero="192/2026"
        tipoExameNome="Balística"
        nomeEnvolvido="João da Silva"
        status="Em andamento"
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
    expect(screen.getByText('Em andamento')).toHaveClass(
      'bg-amber-100',
      'text-amber-800',
      'border-amber-300',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ir ao final' }));
    expect(onIrAoFinal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Alterações não salvas');
    expect(visualizar.compareDocumentPosition(exportar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(exportar.compareDocumentPosition(salvar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(salvar).toHaveClass('bg-primary');
  });

  it('expõe as preferências acessíveis da barra do editor', () => {
    const onModoConteudoChange = vi.fn();
    const onModoOrganizacaoChange = vi.fn();

    render(
      <TooltipProvider>
        <BarraEditorLaudo
          modoConteudo="dados"
          modoOrganizacao="single"
          onModoConteudoChange={onModoConteudoChange}
          onModoOrganizacaoChange={onModoOrganizacaoChange}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole('group', { name: 'Conteúdo exibido' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Organização' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dados da REP/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Documento único/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Placeholders/ }));
    fireEvent.click(screen.getByRole('button', { name: /Por seções/ }));

    expect(onModoConteudoChange).toHaveBeenCalledWith('chaves');
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
    render(
      <DialogoAplicarRespostaIa
        open
        secaoTitulo="CONCLUSÃO"
        conteudoAtual="Texto atual"
        conteudoProposto="Texto revisado"
        onOpenChange={vi.fn()}
        onConfirmar={onConfirmar}
      />,
    );

    expect(screen.getByText(/substituirá todo o conteúdo de “CONCLUSÃO”/)).toBeInTheDocument();
    expect(screen.getByText('Texto atual')).toBeInTheDocument();
    expect(screen.getByText('Texto revisado')).toBeInTheDocument();

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

  it('ignora a normalização inicial e registra somente mudanças efetivas', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());

    act(() => {
      result.current.iniciarSessao();
      result.current.registrarAlteracao('normalizacao-inicial');
    });
    expect(result.current.estadoSalvamento).toBe('salvo');

    act(() => result.current.registrarAlteracao());
    expect(result.current.estadoSalvamento).toBe('pendente');
  });

  it('impede salvamentos concorrentes e preserva mudanças feitas durante o salvamento', () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());

    act(() => result.current.iniciarSessao());
    act(() => {
      expect(result.current.iniciarSalvamento()).toBe(true);
      expect(result.current.iniciarSalvamento()).toBe(false);
      result.current.registrarAlteracao();
      result.current.concluirSalvamento();
    });

    expect(result.current.estadoSalvamento).toBe('pendente');
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
