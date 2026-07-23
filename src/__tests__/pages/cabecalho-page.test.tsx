import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CabecalhoPage } from '@/pages/CabecalhoPage'

const rastreadorEditor = vi.hoisted(() => ({
  montagens: vi.fn(),
  desmontagens: vi.fn(),
}))

vi.mock('@/components/editor/TinyMceEditor', async () => {
  const React = await import('react')

  return {
    TinyMceEditor: ({ editorId, value }: { editorId?: string; value?: string }) => {
      React.useEffect(() => {
        rastreadorEditor.montagens(editorId)
        return () => rastreadorEditor.desmontagens(editorId)
      }, [editorId])

      return <div data-testid={editorId} data-conteudo={value} />
    },
  }
})

vi.mock('@/components/editor/PlaceholderContextMenu', () => ({
  PlaceholderContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

interface PromessaAdiada<T> {
  promessa: Promise<T>
  resolver: (valor: T) => void
}

function criarPromessaAdiada<T>(): PromessaAdiada<T> {
  let resolver: (valor: T) => void = () => undefined
  const promessa = new Promise<T>(resolve => {
    resolver = resolve
  })

  return { promessa, resolver }
}

const ipcApiOriginal = window.ipcAPI
const obterConfiguracao = vi.fn()
const buscarCategorias = vi.fn()
const buscarPlaceholders = vi.fn()

describe('CabecalhoPage', () => {
  beforeEach(() => {
    rastreadorEditor.montagens.mockReset()
    rastreadorEditor.desmontagens.mockReset()
    obterConfiguracao.mockReset()
    buscarCategorias.mockReset()
    buscarPlaceholders.mockReset()

    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        configuracao: { ...ipcApiOriginal.configuracao, obter: obterConfiguracao },
        categoria: { ...ipcApiOriginal.categoria, findAll: buscarCategorias },
        placeholder: { ...ipcApiOriginal.placeholder, findAll: buscarPlaceholders },
      },
      writable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true })
  })

  it('mantém os editores montados quando os placeholders terminam de carregar', async () => {
    const cabecalho = criarPromessaAdiada<{ success: boolean; data?: string }>()
    const cabecalhoPaginas = criarPromessaAdiada<{ success: boolean; data?: string }>()
    const categorias = criarPromessaAdiada<{ success: boolean; data?: Array<{ id: string; label: string; icone: string; cor: string }> }>()
    const placeholders = criarPromessaAdiada<{ success: boolean; data?: Array<{ id: string; chave: string; descricao: string; categoria_id: string }> }>()

    obterConfiguracao.mockImplementation((chave: string) => (
      chave === 'cabecalho_laudo' ? cabecalho.promessa : cabecalhoPaginas.promessa
    ))
    buscarCategorias.mockReturnValue(categorias.promessa)
    buscarPlaceholders.mockReturnValue(placeholders.promessa)

    render(<CabecalhoPage />)

    expect(screen.getAllByText('Carregando...')).toHaveLength(2)

    cabecalho.resolver({ success: true, data: '<p>{{perito.nome}}</p>' })
    cabecalhoPaginas.resolver({ success: true, data: '<p>{{numero_rep}}</p>' })
    categorias.resolver({ success: true, data: [{ id: 'geral', label: 'Geral', icone: 'Tag', cor: 'azul' }] })

    await waitFor(() => expect(obterConfiguracao).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('cabecalho-editor')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cabecalho-paginas-editor')).not.toBeInTheDocument()

    placeholders.resolver({
      success: true,
      data: [
        { id: 'placeholder-1', chave: 'perito.nome', descricao: 'Nome do perito', categoria_id: 'geral' },
        { id: 'placeholder-2', chave: 'numero_rep', descricao: 'Número da REP', categoria_id: 'geral' },
      ],
    })

    const editorPrimeiraPagina = await screen.findByTestId('cabecalho-editor')
    const editorTodasPaginas = await screen.findByTestId('cabecalho-paginas-editor')

    expect(rastreadorEditor.montagens).toHaveBeenCalledTimes(2)
    expect(rastreadorEditor.desmontagens).not.toHaveBeenCalled()
    expect(editorPrimeiraPagina).toHaveAttribute('data-conteudo', expect.stringContaining('placeholder-tag'))
    expect(editorTodasPaginas).toHaveAttribute('data-conteudo', expect.stringContaining('placeholder-tag'))
  })
})
