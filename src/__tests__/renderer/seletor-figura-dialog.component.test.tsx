import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeletorFiguraDialog } from '@/components/laudo/SeletorFiguraDialog';

const figuraOriginal = {
  id: 'figura-original',
  url: 'data:image/png;base64,AA==',
  thumbnailUrl: 'data:image/png;base64,AA==',
  legenda: 'Vista geral do objeto',
  numero_figura: 1,
  sequencia: 1,
  created_at: '',
  dummy: true,
};

const imagemDisponivel = {
  id: 'imagem-nova',
  url: 'data:image/png;base64,BB==',
  thumbnailUrl: 'data:image/png;base64,BB==',
  legenda: 'Nome sugerido pelo arquivo',
  numero_figura: 1,
  sequencia: 1,
  created_at: '',
  nomeArquivo: 'foto-rep.png',
};

describe('SeletorFiguraDialog', () => {
  it('oferece prévia e legenda da imagem na inserção, sem confirmar ao cancelar', () => {
    const onConfirmar = vi.fn();
    const onAbertoChange = vi.fn();
    render(
      <SeletorFiguraDialog
        modo="inserir"
        laudoId="laudo-teste"
        aberto
        figuraAlvo={null}
        imagens={[imagemDisponivel]}
        imagemSelecionadaId="imagem-nova"
        onAbertoChange={onAbertoChange}
        onSelecionar={vi.fn()}
        onConfirmar={onConfirmar}
        onBuscarGdl={vi.fn()}
      />,
    );
    expect(screen.getByText('Prévia da figura')).toBeInTheDocument();
    expect(screen.getByLabelText('Legenda da nova figura')).toHaveValue('Nome sugerido pelo arquivo');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onAbertoChange).toHaveBeenCalledWith(false);
    expect(onConfirmar).not.toHaveBeenCalled();
  });
  it('replica e permite editar a legenda da figura original antes de confirmar', () => {
    const onConfirmar = vi.fn();
    render(
      <SeletorFiguraDialog
        laudoId="laudo-teste"
        aberto
        figuraAlvo={figuraOriginal}
        imagens={[imagemDisponivel]}
        imagemSelecionadaId="imagem-nova"
        onAbertoChange={vi.fn()}
        onSelecionar={vi.fn()}
        onConfirmar={onConfirmar}
        onBuscarGdl={vi.fn()}
      />,
    );

    const legenda = screen.getByLabelText('Legenda da nova figura');
    expect(screen.getByText('Substituir Figuras')).toBeInTheDocument();
    expect(screen.getByLabelText('Figura original será substituída pela nova figura')).toBeInTheDocument();
    expect(legenda).toHaveValue('Vista geral do objeto');
    fireEvent.change(legenda, { target: { value: 'Vista frontal do objeto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Substituir figura' }));

    expect(onConfirmar).toHaveBeenCalledWith('Vista frontal do objeto', undefined);
  });

  it('gera uma legenda da nova figura por IA', async () => {
    const onGerarLegenda = vi.fn().mockResolvedValue('Vista lateral da arma apreendida');
    render(
      <SeletorFiguraDialog
        laudoId="laudo-teste"
        aberto
        figuraAlvo={figuraOriginal}
        imagens={[imagemDisponivel]}
        imagemSelecionadaId="imagem-nova"
        onAbertoChange={vi.fn()}
        onSelecionar={vi.fn()}
        onConfirmar={vi.fn()}
        onBuscarGdl={vi.fn()}
        onGerarLegenda={onGerarLegenda}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Descrição com IA' }));

    await waitFor(() => expect(screen.getByLabelText('Legenda da nova figura')).toHaveValue('Vista lateral da arma apreendida'));
    expect(onGerarLegenda).toHaveBeenCalledWith('imagem-nova');
  });
});
