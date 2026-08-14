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
      configuracao: {
        obter: vi.fn().mockResolvedValue({ success: true, data: 'gemini' }),
      },
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
          progresso: null,
          planoPendente: null,
          retomada: null,
      mensagens: [],
      escopos: [{ id: -1, titulo: 'Documento completo' }],
    };
    act(() => receberEstado?.({ tipo: 'snapshot', estado }));

    fireEvent.click(screen.getByRole('button', { name: 'Ortografia' }));
    expect(painelEnviarComando).toHaveBeenCalledWith({ tipo: 'executar_acao', acao: 'ortografia' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Pedido livre ao assistente IA' }), {
      target: { value: 'Torne o texto objetivo.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido livre' }));
    expect(painelEnviarComando).toHaveBeenCalledWith({
      tipo: 'enviar_pedido_livre',
      mensagem: 'Torne o texto objetivo.',
      modo: 'perguntar',
      tamanho: 'automatico',
    });

    act(() => receberEstado?.({
      tipo: 'delta',
      revisao: 2,
      alteracoes: {
        mensagens: [{
          id: 'mensagem-1',
          role: 'assistant',
          content: 'Texto revisado.',
          timestamp: Date.now(),
          acao: 'clareza',
          aplicacao: 'substituir',
          permiteAplicacao: true,
        }],
      },
    }));
    expect(screen.getByText('Texto revisado.')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Copiar resposta'));
    expect(copiarResposta).toHaveBeenCalledWith('Texto revisado.');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar substituição' }));
    expect(painelEnviarComando).toHaveBeenCalledWith({ tipo: 'aplicar_resposta', mensagemId: 'mensagem-1' });

    act(() => receberEstado?.({
      tipo: 'delta',
      revisao: 3,
      alteracoes: { imagemSelecionada: true },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Descrever novamente' }));
    expect(painelEnviarComando).toHaveBeenCalledWith({ tipo: 'descrever_imagem' });

    act(() => receberEstado?.({
      tipo: 'delta',
      revisao: 4,
      alteracoes: { carregando: true },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(painelEnviarComando).toHaveBeenCalledWith({ tipo: 'cancelar_operacao' });

    act(() => receberEstado?.({
      tipo: 'delta',
      revisao: 5,
      alteracoes: {
        carregando: false,
        retomada: { retomadaId: 'retomada-1', planoId: 'plano-1', lotesConcluidos: 1, totalLotes: 2 },
      },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar do lote 2 de 2' }));
    expect(painelEnviarComando).toHaveBeenCalledWith({ tipo: 'retomar_operacao' });

    fireEvent.click(screen.getByRole('button', { name: /reencaixar/i }));
    expect(painelReencaixar).toHaveBeenCalledTimes(1);
  });

  it('ignora revisões antigas e solicita ressincronização ao detectar uma lacuna', () => {
    renderizarJanela();
    const estado: EstadoPainelIa = {
      revisao: 1,
      titulo: 'Seção inicial',
      carregando: false,
      erro: null,
      editorDisponivel: true,
      imagemSelecionada: false,
      contextoImagem: false,
          modoAplicacao: 'substituir',
          progresso: null,
          planoPendente: null,
          retomada: null,
      mensagens: [],
      escopos: [],
    };

    act(() => receberEstado?.({ tipo: 'snapshot', estado }));
    act(() => receberEstado?.({
      tipo: 'delta',
      revisao: 3,
      alteracoes: { titulo: 'Estado com lacuna' },
    }));
    expect(document.body).not.toHaveTextContent('Estado com lacuna');
    expect(painelEnviarComando).toHaveBeenCalledWith({ tipo: 'solicitar_ressincronizacao' });

    act(() => receberEstado?.({
      tipo: 'snapshot',
      estado: { ...estado, revisao: 4, titulo: 'Estado ressincronizado' },
    }));
    expect(document.body).toHaveTextContent('Estado ressincronizado');

    act(() => receberEstado?.({
      tipo: 'delta',
      revisao: 2,
      alteracoes: { titulo: 'Estado atrasado' },
    }));
    expect(document.body).not.toHaveTextContent('Estado atrasado');
  });
});
