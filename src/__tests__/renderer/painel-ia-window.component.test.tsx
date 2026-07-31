import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PainelIaWindow from '@/pages/PainelIaWindow';
import type { EstadoPainelIa } from '@shared/types/ia.types';

const painelPronto = vi.fn();
const painelEnviarComando = vi.fn();
const painelReencaixar = vi.fn();
const copiarResposta = vi.fn().mockResolvedValue({ success: true });
let receberEstado: ((estado: unknown) => void) | undefined;

function renderizarJanela() {
  return render(
    <MemoryRouter initialEntries={['/painel-ia?sessionId=sessao-teste']}>
      <Routes>
        <Route path="/painel-ia" element={<PainelIaWindow />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PainelIaWindow', () => {
  beforeEach(() => {
    receberEstado = undefined;
    Object.assign(window.ipcAPI, {
      ia: {
        painelPronto,
        painelEnviarComando,
        painelReencaixar,
        copiarResposta,
        onPainelEstado: vi.fn((callback: (estado: unknown) => void) => {
          receberEstado = callback;
          return vi.fn();
        }),
      },
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('apresenta o histórico sincronizado e encaminha comandos ao editor proprietário', () => {
    renderizarJanela();
    expect(painelPronto).toHaveBeenCalledTimes(1);

    const estado: EstadoPainelIa = {
      revisao: 1,
      titulo: 'Documento completo',
      carregando: false,
      erro: null,
      editorDisponivel: true,
      imagemSelecionada: false,
      contextoImagem: false,
      modoAplicacao: 'substituir',
      mensagens: [],
      escopos: [{ id: -1, titulo: 'Documento completo' }],
    };
    act(() => receberEstado?.(estado));

    fireEvent.click(screen.getByRole('button', { name: 'Ortografia' }));
    expect(painelEnviarComando).toHaveBeenCalledWith({ tipo: 'executar_acao', acao: 'ortografia' });

    act(() => receberEstado?.({
      ...estado,
      revisao: 2,
      mensagens: [{
        role: 'assistant',
        content: 'Texto revisado.',
        timestamp: Date.now(),
        acao: 'clareza',
        aplicacao: 'substituir',
        permiteAplicacao: true,
      }],
    }));
    expect(screen.getByText('Texto revisado.')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Copiar resposta'));
    expect(copiarResposta).toHaveBeenCalledWith('Texto revisado.');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar substituição' }));
    expect(painelEnviarComando).toHaveBeenCalledWith({ tipo: 'aplicar_resposta', indiceMensagem: 0 });

    fireEvent.click(screen.getByRole('button', { name: /reencaixar/i }));
    expect(painelReencaixar).toHaveBeenCalledTimes(1);
  });
});
