import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AISheet } from '@/components/ai/AISheet'

describe('AISheet — descrição de imagem', () => {
  beforeEach(() => {
    Object.assign(window.ipcAPI, {
      configuracao: {
        obter: vi.fn().mockResolvedValue({ success: true, data: 'gemini' }),
      },
    })
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('deve apresentar contexto exclusivo e iniciar a descrição da imagem selecionada', () => {
    const onDescreverImagens = vi.fn()

    render(
      <AISheet
        open
        onOpenChange={vi.fn()}
        secaoTitulo="Imagem selecionada"
        editorId=""
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        onDescreverImagens={onDescreverImagens}
        imagemSelecionada
        contextoImagem
      />,
    )

    expect(screen.getByText('Contexto atual: Imagem selecionada')).toBeInTheDocument()
    const botao = screen.getByRole('button', { name: 'Descrever imagem selecionada' })
    expect(botao).toBeEnabled()
    fireEvent.click(botao)
    expect(onDescreverImagens).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('textbox', { name: 'Pedido livre ao assistente IA' })).not.toBeInTheDocument()
    expect(screen.getByText(/não será inserida automaticamente/i)).toBeInTheDocument()
  })

  it('deve permitir copiar a descrição sem oferecer aplicação automática', () => {
    render(
      <AISheet
        open
        onOpenChange={vi.fn()}
        secaoTitulo="Imagem selecionada"
        editorId=""
        messages={[{
          role: 'assistant',
          content: 'Observa-se um objeto metálico sobre superfície clara.',
          timestamp: Date.now(),
          acao: 'descrever_imagem',
        }]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        imagemSelecionada
        contextoImagem
      />,
    )

    expect(screen.getByText('Observa-se um objeto metálico sobre superfície clara.')).toBeInTheDocument()
    expect(screen.getByTitle('Copiar resposta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descrever novamente' })).toBeInTheDocument()
    expect(screen.queryByText('Inserir no cursor')).not.toBeInTheDocument()
    expect(screen.queryByText('Revisar substituição')).not.toBeInTheDocument()
  })

  it('permite escolher entre inserir no cursor e reescrever o escopo no pedido livre', () => {
    const onSendMessage = vi.fn()

    render(
      <AISheet
        open
        onOpenChange={vi.fn()}
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[]}
        onSendMessage={onSendMessage}
        onApplyResponse={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reescrever escopo' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Pedido livre ao assistente IA' }), {
      target: { value: 'Use redação mais objetiva.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido livre' }))

    expect(onSendMessage).toHaveBeenCalledWith('Use redação mais objetiva.', 'reescrever')
  })

  it('oferece cancelamento explícito enquanto uma operação está em andamento', () => {
    const onCancelarOperacao = vi.fn()

    render(
      <AISheet
        open
        onOpenChange={vi.fn()}
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        loading
        onCancelarOperacao={onCancelarOperacao}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelarOperacao).toHaveBeenCalledTimes(1)
  })
})
