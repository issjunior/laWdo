import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GdlImagensRepModal } from '@/components/laudo/GdlImagensRepModal'

const ipcApiOriginal = window.ipcAPI
const listarImagensLaudo = vi.fn()
const capturarImagensLaudo = vi.fn()
const fecharSessaoImagensLaudo = vi.fn()
const idSelecao = 'a'.repeat(64)

function obterCaixaDaFoto(nomeArquivo: string): HTMLElement {
  const item = screen.getByText(nomeArquivo).closest('label')
  const caixa = item?.querySelector<HTMLElement>('[role="checkbox"]')
  if (!caixa) throw new Error(`Caixa de seleção não encontrada para ${nomeArquivo}`)
  return caixa
}

describe('GdlImagensRepModal', () => {
  beforeEach(() => {
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
      data: { imagens: [{ idSelecao, nomeArquivo: 'fotografia.png', mimeType: 'image/png', tamanho: 8, dataUri: 'data:image/png;base64,AA==', sha256: 'c'.repeat(64) }], duplicadas: [], falhas: [] },
    })
    Object.defineProperty(window, 'ipcAPI', {
      value: { ...ipcApiOriginal, gdl: { ...ipcApiOriginal.gdl, listarImagensLaudo, capturarImagensLaudo, fecharSessaoImagensLaudo } },
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
    fireEvent.click(caixaFotografia)
    fireEvent.click(await screen.findByRole('button', { name: 'Capturar imagens (1)' }))

    await waitFor(() => expect(capturarImagensLaudo).toHaveBeenCalledWith('laudo-1', 'sessao-imagens-1', [idSelecao], false))
    expect(onCapturadas).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ idSelecao })]), false)
    expect(onAbertoChange).toHaveBeenCalledWith(false)
  })

  it('seleciona e desmarca apenas as imagens elegíveis de uma vez', async () => {
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={vi.fn()} onCapturadas={vi.fn()} />)

    await screen.findByText('fotografia.png')
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todas' }))
    expect(screen.getByRole('button', { name: 'Capturar imagens (1)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Desmarcar todas' })).toBeInTheDocument()

    expect(obterCaixaDaFoto('fotografia.png')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar todas' }))
    expect(screen.getByRole('button', { name: 'Capturar imagens (0)' })).toBeDisabled()
  })

  it('filtra fotos pelo nome e permite ajustar a quantidade de colunas', async () => {
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={vi.fn()} onCapturadas={vi.fn()} />)

    await screen.findByText('fotografia.png')
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar colunas' }))
    expect(screen.getByText('3 colunas')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar fotos por nome' }), { target: { value: 'tiff' } })

    expect(screen.queryByText('fotografia.png')).not.toBeInTheDocument()
    expect(screen.getByText('Nenhuma foto encontrada com os filtros selecionados.')).toBeInTheDocument()
    expect(screen.getByText('0 de 2 foto(s) exibida(s)')).toBeInTheDocument()
  })
})
