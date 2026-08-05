import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistenteIaPanel } from '@/components/ai/AssistenteIaPanel'

describe('AssistenteIaPanel — descrição de imagem', () => {
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
      <AssistenteIaPanel
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
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeInTheDocument()
  })

  it('deve permitir copiar a descrição sem oferecer aplicação automática', () => {
    render(
      <AssistenteIaPanel
        secaoTitulo="Imagem selecionada"
        editorId=""
        messages={[{
          id: 'mensagem-descricao-1',
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
      <AssistenteIaPanel
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

  it('permite limpar a conversa do contexto atual', () => {
    const onLimparConversa = vi.fn()
    render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[{ id: 'mensagem-1', role: 'assistant', content: 'Resposta anterior', timestamp: Date.now() }]}
        onSendMessage={vi.fn()}
        onLimparConversa={onLimparConversa}
        onApplyResponse={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Limpar conversa' }))
    expect(onLimparConversa).toHaveBeenCalledTimes(1)
  })

  it('oferece cancelamento explícito enquanto uma operação está em andamento', () => {
    const onCancelarOperacao = vi.fn()

    render(
      <AssistenteIaPanel
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

  it('apresenta progresso acessível durante o processamento em lotes', () => {
    render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        loading
        progresso={{
          operationId: 'operacao-1',
          fase: 'processando',
          loteAtual: 2,
          totalLotes: 4,
          tentativa: 1,
          chamadasConcluidas: 1,
        }}
      />,
    )

    expect(screen.getByText('Processando lote 2 de 4')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '1 de 4 lotes concluídos' })).toHaveValue(1)
  })

  it('permite trocar o contexto diretamente pelo seletor', () => {
    const onSelecionarEscopo = vi.fn()
    render(
      <AssistenteIaPanel
        secaoTitulo="PREÂMBULO"
        editorId="secao-0"
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        escopoSelecionado={0}
        opcoesEscopo={[
          { id: -1, titulo: 'Documento completo' },
          { id: 0, titulo: 'Seção: PREÂMBULO' },
        ]}
        onSelecionarEscopo={onSelecionarEscopo}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Contexto atual da IA' }))
    fireEvent.click(screen.getByRole('option', { name: 'Documento completo' }))
    expect(onSelecionarEscopo).toHaveBeenCalledWith(-1)
  })

  it('oferece continuar do lote preservado após uma falha', () => {
    const onRetomarOperacao = vi.fn()
    render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        retomada={{ retomadaId: 'retomada-1', planoId: 'plano-1', lotesConcluidos: 2, totalLotes: 4 }}
        onRetomarOperacao={onRetomarOperacao}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Continuar do lote 3 de 4' }))
    expect(onRetomarOperacao).toHaveBeenCalledTimes(1)
  })
})
