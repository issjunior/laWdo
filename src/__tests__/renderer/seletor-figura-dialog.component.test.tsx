import { fireEvent, render, screen } from '@testing-library/react';
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
  it('replica e permite editar a legenda da figura original antes de confirmar', () => {
    const onConfirmar = vi.fn();
    render(
      <SeletorFiguraDialog
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
    expect(legenda).toHaveValue('Vista geral do objeto');
    fireEvent.change(legenda, { target: { value: 'Vista frontal do objeto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Substituir figura' }));

    expect(onConfirmar).toHaveBeenCalledWith('Vista frontal do objeto');
  });
});
