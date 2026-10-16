import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CabecalhoPage } from '@/pages/CabecalhoPage'

const rastreadorEditor = vi.hoisted(() => ({
  montagens: vi.fn(),
  desmontagens: vi.fn(),
}))

vi.mock('@/components/editor/TinyMceEditor', async () => {
  const React = await import('react')

  return {
    TinyMceEditor: ({ editorId, value, onChange }: { editorId?: string; value?: string; onChange: (html: string) => void }) => {
      React.useEffect(() => {
        rastreadorEditor.montagens(editorId)
        return () => rastreadorEditor.desmontagens(editorId)
      }, [editorId])

      return <textarea data-testid={editorId} data-conteudo={value} value={value ?? ''} onChange={evento => onChange(evento.target.value)} />
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
      chave === 'cabecalho_laudo' ? cabecalho.promessa : chave === 'cabecalho_paginas' ? cabecalhoPaginas.promessa : Promise.resolve({ success: true, data: null })
    ))
    buscarCategorias.mockReturnValue(categorias.promessa)
    buscarPlaceholders.mockReturnValue(placeholders.promessa)

    render(<CabecalhoPage />)

    expect(screen.getAllByText('Carregando...')).toHaveLength(3)

    cabecalho.resolver({ success: true, data: '<p>{{perito.nome}}</p>' })
    cabecalhoPaginas.resolver({ success: true, data: '<p>{{numero_rep}}</p>' })
    categorias.resolver({ success: true, data: [{ id: 'geral', label: 'Geral', icone: 'Tag', cor: 'azul' }] })

    await waitFor(() => expect(obterConfiguracao).toHaveBeenCalledTimes(4))
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

    expect(rastreadorEditor.montagens).toHaveBeenCalledTimes(3)
    expect(rastreadorEditor.desmontagens).not.toHaveBeenCalled()
    expect(editorPrimeiraPagina).toHaveAttribute('data-conteudo', expect.stringContaining('placeholder-tag'))
    expect(editorTodasPaginas).toHaveAttribute('data-conteudo', expect.stringContaining('placeholder-tag'))
  })
  it('salva a desativação sem perder conteúdo e restaura os controles ao reabrir', async () => {
    const registros = new Map<string, string>([
      ['cabecalho_documento', JSON.stringify({ habilitado: true, primeiraPagina: '<p>Cabeçalho salvo</p>', todasPaginas: '<p>Contador salvo</p>' })],
      ['fechamento_laudo', JSON.stringify({ habilitado: true, conteudo: '<p>Fechamento salvo</p>', espacamentoAntesPt: 36 })],
    ])
    obterConfiguracao.mockImplementation((chave: string) => Promise.resolve({ success: true, data: registros.get(chave) ?? null }))
    buscarCategorias.mockResolvedValue({ success: true, data: [] })
    buscarPlaceholders.mockResolvedValue({ success: true, data: [] })
    const salvar = vi.fn(async (...argumentos: unknown[]) => {
      const [chave, valor] = argumentos
      if (typeof chave !== 'string' || typeof valor !== 'string') throw new Error('Configuração de teste inválida')
      registros.set(chave, valor)
      return { success: true, error: '' }
    })
    window.ipcAPI.configuracao.salvar = salvar
    const primeira = render(<CabecalhoPage />)
    await screen.findByTestId('cabecalho-editor')
    fireEvent.click(screen.getByLabelText('Inserir cabeçalho nos laudos'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cabeçalho' }))
    await screen.findByText('Cabeçalho salvo para os novos laudos.')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fechamento' }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByLabelText('Inserir fechamento nos laudos'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar fechamento' }))
    await screen.findByText('Fechamento salvo para os novos laudos.')
    expect(salvar).toHaveBeenCalledWith('cabecalho_documento', JSON.stringify({ habilitado: false, primeiraPagina: '<p>Cabeçalho salvo</p>', todasPaginas: '<p>Contador salvo</p>' }), 'json', expect.any(String))
    expect(salvar).toHaveBeenCalledWith('fechamento_laudo', JSON.stringify({ habilitado: false, conteudo: '<p>Fechamento salvo</p>', espacamentoAntesPt: 36 }), 'json', expect.any(String))
    primeira.unmount()
    render(<CabecalhoPage />)
    expect(await screen.findByTestId('cabecalho-editor')).toHaveAttribute('data-conteudo', '<p>Cabeçalho salvo</p>')
    expect(screen.getByTestId('fechamento-editor')).toHaveAttribute('data-conteudo', '<p>Fechamento salvo</p>')
    expect(screen.getByLabelText('Inserir cabeçalho nos laudos')).not.toBeChecked()
    expect(screen.getByLabelText('Inserir fechamento nos laudos')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText('Inserir cabeçalho nos laudos'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cabeçalho' }))
    await waitFor(() => expect(registros.get('cabecalho_documento')).toContain('"habilitado":true'))
  })

  it.each(['cabecalho-editor', 'cabecalho-paginas-editor', 'fechamento-editor'])('preserva o HTML de %s durante a digitação e outras atualizações da página', async editorId => {
    obterConfiguracao.mockResolvedValue({ success: true, data: null })
    buscarCategorias.mockResolvedValue({ success: true, data: [] })
    buscarPlaceholders.mockResolvedValue({ success: true, data: [] })
    render(<CabecalhoPage />)
    const editor = await screen.findByTestId(editorId)
    const htmlDigitado = '<p>Antes<br />{{perito_nome}}&nbsp;Depois</p>'
    fireEvent.change(editor, { target: { value: htmlDigitado } })
    expect(editor).toHaveAttribute('data-conteudo', htmlDigitado)
    fireEvent.change(screen.getByLabelText('Espaçamento acima (pontos)'), { target: { value: '36' } })
    expect(editor).toHaveAttribute('data-conteudo', htmlDigitado)
    expect(rastreadorEditor.montagens).toHaveBeenCalledTimes(3)
    expect(rastreadorEditor.desmontagens).not.toHaveBeenCalled()
  })

  it('normaliza os placeholders ao inserir o modelo de fechamento', async () => {
    obterConfiguracao.mockResolvedValue({ success: true, data: null })
    buscarCategorias.mockResolvedValue({ success: true, data: [] })
    buscarPlaceholders.mockResolvedValue({ success: true, data: [] })
    render(<CabecalhoPage />)
    const editor = await screen.findByTestId('fechamento-editor')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fechamento' }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole('button', { name: 'Inserir modelo de fechamento' }))
    expect(editor).toHaveAttribute('data-conteudo', expect.stringContaining('placeholder-tag'))
    expect(editor).toHaveAttribute('data-conteudo', expect.stringContaining('contenteditable="false"'))
  })



})
