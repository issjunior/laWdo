import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GdlImagensRepModal } from '@/components/laudo/GdlImagensRepModal'

const ipcApiOriginal = window.ipcAPI
const listarImagensLaudo = vi.fn()
const capturarImagensLaudo = vi.fn()
const idSelecao = 'a'.repeat(64)

describe('GdlImagensRepModal', () => {
  beforeEach(() => {
    listarImagensLaudo.mockResolvedValue({
      success: true,
      data: [
        { idSelecao, origem: 'lista_fotos', nomeArquivo: 'fotografia.png', tamanho: 1024, dataUpload: null, provavelImagem: true, status: null },
        { idSelecao: 'b'.repeat(64), origem: 'lista_fotos', nomeArquivo: 'foto.tiff', tamanho: 1024, dataUpload: null, provavelImagem: false, status: 'Formato não compatível para captura' },
      ],
    })
    capturarImagensLaudo.mockResolvedValue({
      success: true,
      data: { imagens: [{ idSelecao, nomeArquivo: 'fotografia.png', mimeType: 'image/png', tamanho: 8, dataUri: 'data:image/png;base64,AA==', sha256: 'c'.repeat(64) }], falhas: [] },
    })
    Object.defineProperty(window, 'ipcAPI', {
      value: { ...ipcApiOriginal, gdl: { ...ipcApiOriginal.gdl, listarImagensLaudo, capturarImagensLaudo } },
      writable: true,
    })
  })

  afterAll(() => Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true }))

  it('lista metadados antes de baixar e captura somente a imagem selecionada', async () => {
    const onCapturadas = vi.fn()
    const onAbertoChange = vi.fn()
    render(<GdlImagensRepModal aberto laudoId="laudo-1" onAbertoChange={onAbertoChange} onCapturadas={onCapturadas} />)

    expect(await screen.findByText('fotografia.png')).toBeInTheDocument()
    expect(screen.getByText('foto.tiff')).toBeInTheDocument()
    expect(screen.getAllByText('Lista de Fotos')).toHaveLength(2)
    const caixas = screen.getAllByRole('checkbox')
    expect(caixas[0]).toBeEnabled()
    expect(caixas[1]).toBeDisabled()
    fireEvent.click(caixas[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Capturar imagens (1)' }))

    await waitFor(() => expect(capturarImagensLaudo).toHaveBeenCalledWith('laudo-1', [idSelecao]))
    expect(onCapturadas).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ idSelecao })]))
    expect(onAbertoChange).toHaveBeenCalledWith(false)
  })
})
