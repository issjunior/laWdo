import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GdlImagensRepModal } from '@/components/laudo/GdlImagensRepModal'

const ipcApiOriginal = window.ipcAPI
const listarImagensLaudo = vi.fn()
const capturarImagensLaudo = vi.fn()
const fecharSessaoImagensLaudo = vi.fn()
const obterMiniaturasImagensLaudo = vi.fn()
const idSelecao = 'a'.repeat(64)

function obterCaixaDaFoto(nomeArquivo: string): HTMLElement {
  const item = screen.getByText(nomeArquivo).closest('label')
  const caixa = item?.querySelector<HTMLElement>('[role="checkbox"]')
  if (!caixa) throw new Error(`Caixa de seleção não encontrada para ${nomeArquivo}`)
  return caixa
}

describe('GdlImagensRepModal', () => {
  beforeAll(() => {
    HTMLElement.prototype.hasPointerCapture = () => false
    HTMLElement.prototype.setPointerCapture = () => undefined
    HTMLElement.prototype.releasePointerCapture = () => undefined
    HTMLElement.prototype.scrollIntoView = () => undefined
  })

  beforeEach(() => {
    obterMiniaturasImagensLaudo.mockClear()
    listarImagensLaudo.mockResolvedValue({
      success: true,
      data: {
        sessaoId: 'sessao-imagens-1',
        ambiente: 'producao',
        numeroRep: '109026',
        anoRep: '2026',
        arquivos: [
          { idSelecao, origem: 'lista_fotos', nomeArquivo: 'fotografia.png', tamanho: 1024, dataUpload: null, provavelImagem: true, status: null, thumbnailDataUri: 'data:image/jpeg;base64,AA==' },
          { idSelecao: 'b'.repeat(64), origem: 'lista_fotos', nomeArquivo: 'foto.tiff', tamanho: 1024, dataUpload: null, provavelImagem: false, status: 'Formato não compatível para captura' },
        ],
      },
    })
    capturarImagensLaudo.mockResolvedValue({
      success: true,
      data: { imagens: [{ idSelecao, imagemId: 'imagem-1', nomeArquivo: 'fotografia.png', mimeType: 'image/png', tamanho: 8, sha256: 'c'.repeat(64), sequencia: 1 }], duplicadas: [], falhas: [] },
    })
    Object.defineProperty(window, 'ipcAPI', {
      value: { ...ipcApiOriginal, gdl: { ...ipcApiOriginal.gdl, listarImagensLaudo, capturarImagensLaudo, fecharSessaoImagensLaudo, obterMiniaturasImagensLaudo } },
      writable: true,
    })
  })

  afterAll(() => Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true }))

  it('lista metadados antes de baixar e captura somente a imagem selecionada', async () => {
    const onCapturadas = vi.fn()
    const onAbertoChange = vi.fn()
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={onAbertoChange} onCapturadas={onCapturadas} />)

    expect(await screen.findByText('fotografia.png')).toBeInTheDocument()
    expect(screen.getByText('Produção')).toBeInTheDocument()
    expect(screen.getByText('REP 109.026-2026')).toBeInTheDocument()
    expect(screen.getByText(/Lista de Fotos pode ter até/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Prévia de fotografia.png' })).toHaveAttribute('src', 'data:image/jpeg;base64,AA==')
    const caixaFotografia = obterCaixaDaFoto('fotografia.png')
    expect(caixaFotografia).toBeEnabled()
    expect(caixaFotografia).toBeChecked()
    fireEvent.click(await screen.findByRole('button', { name: 'Capturar imagens (1)' }))

    await waitFor(() => expect(capturarImagensLaudo).toHaveBeenCalledWith('laudo-1', 'sessao-imagens-1', [idSelecao], false))
    await waitFor(() => expect(onCapturadas).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ idSelecao })]), false))
    expect(onAbertoChange).toHaveBeenCalledWith(false)
  })

  it('seleciona e desmarca apenas as imagens elegíveis de uma vez', async () => {
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={vi.fn()} onCapturadas={vi.fn()} />)

    await screen.findByText('fotografia.png')
    expect(screen.getByRole('button', { name: 'Capturar imagens (1)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Desmarcar todas' })).toBeInTheDocument()

    expect(obterCaixaDaFoto('fotografia.png')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todas' }))
    expect(screen.getByRole('button', { name: 'Capturar imagens (0)' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas' }))
    expect(obterCaixaDaFoto('fotografia.png')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Capturar imagens (1)' })).toBeEnabled()
  })

  it('filtra fotos pelo nome e permite ajustar a quantidade de colunas', async () => {
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={vi.fn()} onCapturadas={vi.fn()} />)

    await screen.findByText('fotografia.png')
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar colunas' }))
    expect(screen.getByText('3 colunas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir colunas' }))
    expect(screen.getByText('2 colunas')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar fotos por nome' }), { target: { value: 'tiff' } })

    expect(screen.queryByText('fotografia.png')).not.toBeInTheDocument()
    expect(screen.getByText('Nenhuma foto encontrada com os filtros selecionados.')).toBeInTheDocument()
    expect(screen.getByText('0 de 2 foto(s) exibida(s)')).toBeInTheDocument()
  })

  it('permite alternar entre fotos disponíveis e indisponíveis e alterar a ordenação', async () => {
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={vi.fn()} onCapturadas={vi.fn()} />)

    await screen.findByText('fotografia.png')
    fireEvent.pointerDown(screen.getByRole('combobox', { name: 'Filtrar fotos' }), { button: 0, buttons: 1, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(await screen.findByRole('option', { name: 'Indisponíveis' }))
    expect(screen.getByText('foto.tiff')).toBeInTheDocument()
    expect(obterCaixaDaFoto('foto.tiff')).toBeDisabled()
    expect(obterCaixaDaFoto('foto.tiff')).not.toBeChecked()
    expect(screen.queryByText('fotografia.png')).not.toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole('combobox', { name: 'Filtrar fotos' }), { button: 0, buttons: 1, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(await screen.findByRole('option', { name: 'Disponíveis' }))
    fireEvent.pointerDown(screen.getByRole('combobox', { name: 'Ordenar fotos' }), { button: 0, buttons: 1, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(await screen.findByRole('option', { name: 'Nome: Z a A' }))
    expect(screen.getByText('fotografia.png')).toBeInTheDocument()
  })

  it('remove da seleção a duplicata encontrada durante a captura, sem abrir outro modal', async () => {
    const onCapturadas = vi.fn()
    const obterMiniaturas = vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: 'imagem-existente-1', thumbnailDataUri: 'data:image/jpeg;base64,BB==' }],
    })
    capturarImagensLaudo.mockResolvedValue({
      success: true,
      data: {
        imagens: [],
        falhas: [],
        duplicadas: [{ idSelecao, nomeArquivo: 'fotografia.png', imagemExistenteId: 'imagem-existente-1', localizacao: 'painel' }],
      },
    })
    Object.defineProperty(window, 'ipcAPI', {
      value: { ...window.ipcAPI, ilustracoes: { ...window.ipcAPI.ilustracoes, obterMiniaturas } },
      writable: true,
    })
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={vi.fn()} onCapturadas={onCapturadas} />)

    await screen.findByText('fotografia.png')
    fireEvent.click(screen.getByRole('button', { name: 'Capturar imagens (1)' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Capturar imagens (0)' })).toBeDisabled())
    expect(screen.queryByText('Foto já incluída no laudo')).not.toBeInTheDocument()
    expect(obterMiniaturas).not.toHaveBeenCalled()
    expect(capturarImagensLaudo).toHaveBeenCalledWith('laudo-1', 'sessao-imagens-1', [idSelecao], false)
    expect(onCapturadas).not.toHaveBeenCalled()
  })

  it('oculta todas as fotos já incluídas e impede nova captura', async () => {
    listarImagensLaudo.mockResolvedValue({
      success: true,
      data: {
        sessaoId: 'sessao-imagens-1', ambiente: 'producao', numeroRep: '109026', anoRep: '2026',
        arquivos: [], fotosJaIncluidas: 29,
      },
    })
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={vi.fn()} onCapturadas={vi.fn()} />)

    expect(await screen.findByText('Todas as fotos disponíveis da REP já estão incluídas neste laudo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Capturar imagens (0)' })).toBeDisabled()
    expect(screen.queryByText('fotografia.png')).not.toBeInTheDocument()
    expect(obterMiniaturasImagensLaudo).not.toHaveBeenCalled()
  })

  it('mantém a busca acessível quando a verificação de duplicatas falha', async () => {
    listarImagensLaudo.mockResolvedValue({
      success: true,
      data: {
        sessaoId: 'sessao-imagens-1', ambiente: 'producao', numeroRep: '109026', anoRep: '2026',
        arquivos: [{ idSelecao, origem: 'lista_fotos', nomeArquivo: 'fotografia.png', tamanho: 1024, dataUpload: null, provavelImagem: true, status: null, thumbnailDataUri: 'data:image/jpeg;base64,AA==' }],
        fotosJaIncluidas: 0, avisoVerificacao: 'Não foi possível verificar algumas fotos.',
      },
    })
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={vi.fn()} onCapturadas={vi.fn()} />)

    expect(await screen.findByText('fotografia.png')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível verificar algumas fotos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Capturar imagens (1)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })
})
