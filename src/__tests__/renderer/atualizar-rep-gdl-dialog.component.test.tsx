import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AtualizarRepGdlDialog } from '@/components/rep/AtualizarRepGdlDialog'
import { identificarNaturezaExame } from '../../shared/gdl/natureza-exame'

const ipcApiOriginal = window.ipcAPI
const prepararAtualizacaoRep = vi.fn()
const aplicarAtualizacaoRep = vi.fn()

describe('AtualizarRepGdlDialog', () => {
  beforeEach(() => {
    aplicarAtualizacaoRep.mockResolvedValue({
      success: true,
      data: { camposAtualizados: 1, pecasAtualizadas: 0, laudoReconciliado: true, laudoReaberto: false },
    })
    prepararAtualizacaoRep.mockResolvedValue({
      success: true,
      data: {
        operacaoId: 'operacao-1', repId: 'rep-1', repNumero: '109.026-2026', codigoExame: 'B-602', avisos: [],
        diferencas: [{
          id: 'peca:2694748', categoria: 'peca', grupo: 'Peças B-602', rotulo: 'Peça PISTOLA(S)',
          resumo: 'Identificação: Pistola Taurus', valorLocal: '1 alteração(ões) identificada(s)',
          valorGdl: 'Dados disponíveis no GDL', selecionadaPorPadrao: true,
          detalhes: [{ campo: 'Lacre de saída', valorLocal: 'LS-001', valorGdl: 'LS-002' }],
        }],
      },
    })
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        gdl: { prepararAtualizacaoRep, aplicarAtualizacaoRep },
      },
      writable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true })
  })

  it('oculta o código interno da peça e detalha as alterações sob demanda', async () => {
    render(<AtualizarRepGdlDialog open repId="rep-1" onOpenChange={vi.fn()} onConcluida={vi.fn()} />)

    expect(await screen.findByText('Peça PISTOLA(S)')).toBeInTheDocument()
    expect(screen.getByText('Identificação: Pistola Taurus')).toBeInTheDocument()
    expect(screen.queryByText('2694748')).not.toBeInTheDocument()
    expect(screen.queryByText('Lacre de saída')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver alterações' }))

    expect(screen.getAllByText('Dado local')).not.toHaveLength(0)
    expect(screen.getAllByText('Dados do GDL')).not.toHaveLength(0)
    expect(screen.getByText('Lacre de saída')).toBeInTheDocument()
    expect(screen.getByText('LS-001')).toBeInTheDocument()
    expect(screen.getByText('LS-002')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar alterações' })).toBeInTheDocument()
  })

  it('aguarda a decisão dos detalhes sem declarar a REP atualizada', async () => {
    prepararAtualizacaoRep.mockResolvedValueOnce({ success: true, data: {
      operacaoId: '', repId: 'rep-1', repNumero: '109.026-2026', codigoExame: 'B-602', avisos: [], diferencas: [],
      consultaDetalhes: { consultaId: '11111111-1111-4111-8111-111111111111', identificacao: identificarNaturezaExame('B602 - EXAME DE EFICIÊNCIA E PRESTABILIDADE'), tiposLocais: [], avisos: [],
        detalhes: { estado: 'aguardando_confirmacao', statusAtual: 'ABERTA E DISTRIBUÍDA', motivoConfirmacao: 'A abertura pode avançar o status.' } },
    } });
    render(<AtualizarRepGdlDialog open repId="rep-1" onOpenChange={vi.fn()} onConcluida={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Continuar e abrir detalhes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar somente dados da API' })).toBeInTheDocument();
    expect(screen.queryByText(/A REP já está atualizada/)).not.toBeInTheDocument();
    expect(aplicarAtualizacaoRep).not.toHaveBeenCalled();
  })

  it('fecha o modal depois de aplicar a atualização com sucesso', async () => {
    const onOpenChange = vi.fn()

    render(<AtualizarRepGdlDialog open repId="rep-1" onOpenChange={onOpenChange} onConcluida={vi.fn()} />)

    await screen.findByText('Peça PISTOLA(S)')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar atualização' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar atualização' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('permite reconciliar o laudo quando a REP não possui diferenças', async () => {
    prepararAtualizacaoRep.mockResolvedValueOnce({
      success: true,
      data: {
        operacaoId: 'operacao-reconciliacao', repId: 'rep-1', repNumero: '109.026-2026', codigoExame: 'B-602', avisos: [],
        diferencas: [],
        impactoLaudo: { laudoId: 'laudo-1', status: 'Em andamento', requerReabertura: false },
      },
    })

    render(<AtualizarRepGdlDialog open repId="rep-1" onOpenChange={vi.fn()} onConcluida={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Reconciliar laudo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reconciliação' }))

    await waitFor(() => expect(aplicarAtualizacaoRep).toHaveBeenCalledWith({
      operacaoId: 'operacao-reconciliacao',
      diferencasSelecionadas: [],
      reabrirLaudo: false,
    }))
  })
})

it('mostra erro amigável na atualização manual e reserva detalhes técnicos aos logs', async () => {
  prepararAtualizacaoRep.mockResolvedValueOnce({ success: false, error: 'net::ERR_NAME_NOT_RESOLVED' });
  Object.defineProperty(window, 'ipcAPI', { writable: true, value: { ...ipcApiOriginal, gdl: { prepararAtualizacaoRep, aplicarAtualizacaoRep } } });
  render(<AtualizarRepGdlDialog open repId="rep-1" onOpenChange={vi.fn()} onConcluida={vi.fn()} />);
  expect(await screen.findByText('Não foi possível acessar o GDL. Verifique sua conexão e a VPN institucional e tente novamente.')).toBeInTheDocument();
  expect(screen.queryByText('net::ERR_NAME_NOT_RESOLVED')).not.toBeInTheDocument();
  expect(window.ipcAPI.logWarning).toHaveBeenCalledWith('gdl', expect.stringContaining('ERR_NAME_NOT_RESOLVED'));
});
