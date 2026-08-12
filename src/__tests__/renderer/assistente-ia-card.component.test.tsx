import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AssistenteIaCard } from '@/components/ai/AssistenteIaCard'

describe('AssistenteIaCard', () => {
  const propriedades = {
    secaoIndex: 2,
    secaoTitulo: 'Discussão',
    htmlContent: '<p>Texto da seção.</p><img src="https://exemplo.test/figura.png" alt="Radiografia" />',
    onRevisarOrtografia: vi.fn(),
    onAdequarEscrita: vi.fn(),
    onDescreverImagem: vi.fn(),
    onPerguntar: vi.fn(),
    onOpenSheet: vi.fn(),
  }

  beforeEach(() => {
    Object.assign(window.ipcAPI, {
      configuracao: {
        obter: vi.fn()
          .mockResolvedValueOnce({ success: true, data: 'gemini' })
          .mockResolvedValueOnce({ success: true, data: 'gemini-2.5-flash' }),
      },
    })
  })

  it('carrega o modelo configurado e executa as ações sobre o contexto da seção', async () => {
    render(<AssistenteIaCard {...propriedades} />)

    fireEvent.click(screen.getByRole('button', { name: 'Assistente IA' }))

    expect(await screen.findByText('Modelo ativo: Google Gemini · gemini-2.5-flash')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Revisar ortografia' }))
    await waitFor(() => {
      expect(propriedades.onRevisarOrtografia).toHaveBeenCalledWith(propriedades.htmlContent, 2)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Adequar redação' }))
    await waitFor(() => {
      expect(propriedades.onAdequarEscrita).toHaveBeenCalledWith(propriedades.htmlContent, 2)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Descrever imagens' }))
    await waitFor(() => {
      expect(propriedades.onDescreverImagem).toHaveBeenCalledWith([
        { src: 'https://exemplo.test/figura.png', alt: 'Radiografia' },
      ], 2)
    })

    expect(propriedades.onOpenSheet).toHaveBeenCalledTimes(3)
    expect(propriedades.onOpenSheet).toHaveBeenLastCalledWith(2, 'Discussão')
  })

  it('envia o pedido livre, limpa o campo e permite recolher o cartão', async () => {
    render(<AssistenteIaCard {...propriedades} />)

    fireEvent.click(screen.getByRole('button', { name: 'Assistente IA' }))
    const campoPergunta = screen.getByPlaceholderText('Pergunte sobre esta seção')
    fireEvent.change(campoPergunta, { target: { value: '  Resuma a conclusão.  ' } })
    fireEvent.keyDown(campoPergunta, { key: 'Enter' })

    await waitFor(() => {
      expect(propriedades.onPerguntar).toHaveBeenCalledWith(
        'Resuma a conclusão.',
        propriedades.htmlContent,
        2,
        'Discussão',
      )
    })
    expect(campoPergunta).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Recolher assistente de IA' }))
    expect(screen.getByRole('button', { name: 'Assistente IA' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('bloqueia ações que não possuem conteúdo ou imagem válida', () => {
    render(
      <AssistenteIaCard
        {...propriedades}
        htmlContent=""
        erro="Configure uma IA antes de continuar."
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Assistente IA' }))

    expect(screen.getByText('Configure uma IA antes de continuar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar ortografia' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adequar redação' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descrever imagens' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enviar pergunta à IA' })).toBeDisabled()
  })
})
