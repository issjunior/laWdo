import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { IlustracoesPanel, type ImagemLaudo } from '@/components/laudo/IlustracoesPanel'

const ipcApiOriginal = window.ipcAPI
const listarImagens = vi.fn()
const obterImagem = vi.fn()
const arquivarImagem = vi.fn()
const atualizarLegenda = vi.fn()
const obterMiniaturas = vi.fn()

vi.mock('@/components/laudo/GdlImagensRepModal', () => ({
  GdlImagensRepModal: ({ aberto, onAbertoChange, onCapturadas }: {
    aberto: boolean;
    onAbertoChange: (aberto: boolean) => void;
    onCapturadas: (imagens: Array<{ imagemId: string; nomeArquivo: string; sha256: string; sequencia: number }>, permitirDuplicadas: boolean) => void;
  }) => aberto ? <div role="dialog" aria-label="Lista de Fotos da REP">
    <button onClick={() => onAbertoChange(false)}>Cancelar busca</button>
    <button onClick={() => { onCapturadas([{ imagemId: 'foto-gdl', nomeArquivo: 'foto.png', sha256: 'hash-teste', sequencia: 1 }], false); onAbertoChange(false); }}>Capturar foto de teste</button>
  </div> : null,
}))

const figura: ImagemLaudo = {
  id: 'figura-1',
  url: 'data:image/png;base64,AA==',
  thumbnailUrl: 'data:image/png;base64,AA==',
  legenda: 'Figura de teste',
  numero_figura: 1,
  sequencia: 1,
  created_at: '2026-08-04T00:00:00.000Z',
}

describe('rolagem do painel de ilustrações', () => {
  beforeEach(() => {
    listarImagens.mockResolvedValue({ success: true, data: [] })
    obterImagem.mockResolvedValue({ success: true, data: { dataUri: figura.url } })
    arquivarImagem.mockResolvedValue({ success: true })
    atualizarLegenda.mockResolvedValue({ success: true })
    obterMiniaturas.mockResolvedValue({ success: true, data: [] })
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        desempenho: { registrar: vi.fn() },
        ilustracoes: { listarImagens, obterImagem, arquivarImagem, atualizarLegenda, obterMiniaturas },
      },
      writable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true })
  })

  it('preserva a dummy durante a busca e substitui somente após confirmação', async () => {
    const aoSubstituir = vi.fn()
    render(<IlustracoesPanel laudoId="laudo-1" onInsertImage={vi.fn()} onRefreshHtml={vi.fn()}
      figurasNoEditor={[{ ...figura, dummy: true }]} figuraSubstituicaoSolicitada={figura.id}
      onReplaceImage={aoSubstituir} />)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Buscar REP' }))
    expect(screen.getByRole('dialog', { name: 'Lista de Fotos da REP' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Capturar foto de teste' }))
    const seletor = await screen.findByRole('dialog', { name: 'Substituir figura' })
    expect(aoSubstituir).not.toHaveBeenCalled()
    fireEvent.click(within(seletor).getByRole('button', { name: 'Substituir figura' }))
    await waitFor(() => expect(aoSubstituir).toHaveBeenCalledWith(figura.id,
      expect.objectContaining({ id: 'foto-gdl' }), undefined))
  })

  it('cancelar a busca não substitui nem insere figuras', () => {
    const aoSubstituir = vi.fn()
    const aoInserir = vi.fn()
    render(<IlustracoesPanel laudoId="laudo-1" onInsertImage={aoInserir} onRefreshHtml={vi.fn()}
      figurasNoEditor={[{ ...figura, dummy: true }]} figuraSubstituicaoSolicitada={figura.id}
      onReplaceImage={aoSubstituir} />)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Buscar REP' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar busca' }))
    expect(aoSubstituir).not.toHaveBeenCalled()
    expect(aoInserir).not.toHaveBeenCalled()
  })

  it('mantém o acompanhamento da figura restrito à lista interna', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    const propriedades = {
      laudoId: 'laudo-1',
      onInsertImage: vi.fn(),
      onRefreshHtml: vi.fn(),
      figurasNoEditor: [figura],
    }
    const { rerender } = render(
      <IlustracoesPanel {...propriedades} figuraAtivaId={null} />,
    )

    const item = screen.getByDisplayValue('Figura de teste').closest('.transition-all') as HTMLElement
    const lista = item.parentElement as HTMLElement
    const scrollTo = vi.fn()
    Object.defineProperty(lista, 'scrollTop', { value: 20, writable: true })
    Object.defineProperty(lista, 'scrollTo', { value: scrollTo })
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
      top: 400,
      bottom: 450,
    } as DOMRect)
    vi.spyOn(lista, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 300,
    } as DOMRect)

    rerender(<IlustracoesPanel {...propriedades} figuraAtivaId="figura-1" />)

    expect(scrollTo).toHaveBeenCalledWith({ top: 170, behavior: 'smooth' })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('padroniza o selo visual de figuras de exemplo', () => {
    render(
      <IlustracoesPanel
        laudoId="laudo-1"
        onInsertImage={vi.fn()}
        onRefreshHtml={vi.fn()}
        figurasNoEditor={[{ ...figura, id: 'figura-exemplo', dummy: true }]}
      />,
    )

    expect(screen.getByText('Fig. 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Figura 1, exemplo')).toBeInTheDocument()
    expect(screen.queryByText('Fig. Exemplo')).not.toBeInTheDocument()
  })

  it('restringe a rolagem ao conteúdo para manter o painel completo visível', () => {
    render(
      <IlustracoesPanel
        laudoId="laudo-1"
        onInsertImage={vi.fn()}
        onRefreshHtml={vi.fn()}
      />,
    )

    const cabecalho = screen.getByRole('heading', { name: 'Painel de Ilustrações' }).parentElement
    const painel = cabecalho?.parentElement

    expect(painel).toHaveClass('h-full', 'min-h-0', 'flex-col', 'overflow-hidden')
    expect(cabecalho).toHaveClass('shrink-0')
  })
})
