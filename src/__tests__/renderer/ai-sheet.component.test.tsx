import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistenteIaPanel } from '@/components/ai/AssistenteIaPanel'

describe('AssistenteIaPanel — descrição de imagem', () => {
  beforeEach(() => {
    Object.assign(window.ipcAPI, {
      configuracao: {
        obter: vi.fn().mockResolvedValue({ success: true, data: 'gemini' }),
      },
      ia: {
        copiarResposta: vi.fn().mockResolvedValue({ success: true }),
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

    fireEvent.click(screen.getByRole('tab', { name: 'Reescrever' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Pedido livre ao assistente IA' }), {
      target: { value: 'Use redação mais objetiva.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido livre' }))

    expect(onSendMessage).toHaveBeenCalledWith('Use redação mais objetiva.', 'reescrever', 'automatico')
  })

  it('preserva o rascunho ao trocar de modo e só envia com Enter sem Shift', () => {
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

    const campo = screen.getByRole('textbox', { name: 'Pedido livre ao assistente IA' })
    fireEvent.change(campo, { target: { value: 'Texto a preservar.' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Escrever' }))
    expect(campo).toHaveValue('Texto a preservar.')
    fireEvent.keyDown(campo, { key: 'Enter', shiftKey: true })
    expect(onSendMessage).not.toHaveBeenCalled()
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(onSendMessage).toHaveBeenCalledWith('Texto a preservar.', 'escrever', 'automatico')
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

  it('mostra prazo apenas quando o provedor o informou', () => {
    const { rerender } = render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId=""
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        error="O provedor recusou esta solicitação devido a um limite de uso. Verifique o aviso para os detalhes informados."
        avisoLimite={{ mensagem: 'O Gemini recusou a solicitação por limite de uso, mas não informou qual limite foi atingido.' }}
      />,
    )

    expect(screen.getByText(/não informou qual limite/i)).toBeInTheDocument()
    expect(screen.queryByText(/Nova tentativa recomendada após/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Verifique o aviso para os detalhes/i)).not.toBeInTheDocument()

    rerender(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId=""
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        avisoLimite={{ mensagem: 'O Gemini informou que o limite de tokens foi atingido.', tentarNovamenteEm: Date.now() + 60_000 }}
      />,
    )

    expect(screen.getByText(/Nova tentativa recomendada após/i)).toBeInTheDocument()
  })

  it('exibe evidências recolhíveis e permite navegar ao trecho que sustenta a resposta', () => {
    const onNavegarEvidencia = vi.fn()
    render(
      <AssistenteIaPanel
        secaoTitulo="Armas"
        editorId="secao-0"
        messages={[{
          id: 'consulta-1',
          role: 'assistant',
          content: 'Foram examinadas três armas.',
          timestamp: Date.now(),
          estadoConsulta: 'respondida',
          modeloConsulta: 'gemini-2.5-flash',
          evidencias: [{ id: 'secao-0:1', tipo: 'tabela', ordem: 0, secaoId: 'secao-0', secaoTitulo: 'Armas', titulo: 'Tabela de armas', texto: 'Arma A, B e C', ancora: 'tabela-armas' }],
        }]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        onNavegarEvidencia={onNavegarEvidencia}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Evidências (1)' }))
    expect(screen.getByText(/Tabela de armas/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ver no laudo/ }))
    expect(onNavegarEvidencia).toHaveBeenCalledWith(expect.objectContaining({ id: 'secao-0:1' }))
  })

  it('mantém evidências abertas quando o estado sincronizado atualiza a resposta', () => {
    const mensagem = {
      id: 'consulta-1',
      role: 'assistant' as const,
      content: 'Foram examinadas três armas.',
      timestamp: Date.now(),
      evidencias: [{ id: 'secao-0:1', tipo: 'tabela' as const, ordem: 0, secaoId: 'secao-0', secaoTitulo: 'Armas', titulo: 'Tabela de armas', texto: 'Arma A', ancora: 'tabela-armas' }],
    }
    const { rerender } = render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[mensagem]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Evidências (1)' }))
    expect(screen.getByText(/Tabela de armas/)).toBeVisible()
    rerender(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[{ ...mensagem, content: 'Foram examinadas três armas, com evidência validada.' }]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
      />,
    )

    expect(screen.getByText(/Tabela de armas/)).toBeVisible()
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

  it('agrupa modelos por perfil e desabilita os indisponíveis', () => {
    render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        modeloSelecionado="flash"
        opcoesModelo={[
          { id: 'flash', rotulo: 'Flash', perfil: 'rapido', disponibilidade: 'disponivel' },
          { id: 'pro', rotulo: 'Pro', perfil: 'maior_precisao', disponibilidade: 'removido' },
        ]}
        onSelecionarModelo={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Modelo da IA para esta sessão' }))
    expect(screen.getByText('Rápido')).toBeInTheDocument()
    expect(screen.getByText('Maior precisão')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Pro.*Removido/ })).toHaveAttribute('data-disabled')
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

  it.each([
    ['Curta', 'curta'],
    ['Média', 'media'],
    ['Longa', 'longa'],
  ] as const)('envia pedido livre com o tamanho %s selecionado', (rotulo, tamanho) => {
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

    fireEvent.click(screen.getByRole('tab', { name: 'Escrever' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Tamanho da resposta' }))
    fireEvent.click(screen.getByRole('option', { name: rotulo }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Pedido livre ao assistente IA' }), { target: { value: 'Ajuste o texto.' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Pedido livre ao assistente IA' }), { key: 'Enter' })

    expect(onSendMessage).toHaveBeenCalledWith('Ajuste o texto.', 'escrever', tamanho)
  })

  it('encaminha ações, reenvio, cópia e aplicação conforme as permissões da mensagem', () => {
    const onExecutarAcao = vi.fn()
    const onReenviarMensagem = vi.fn()
    const onApplyResponse = vi.fn()
    const mensagens = [
      { id: 'usuario-1', role: 'user' as const, content: 'Pedido anterior', timestamp: Date.now(), permiteReenvio: true },
      { id: 'assistente-1', role: 'assistant' as const, content: 'Resposta pronta', timestamp: Date.now(), aplicacao: 'inserir' as const, permiteAplicacao: true },
    ]
    render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={mensagens}
        onSendMessage={vi.fn()}
        onApplyResponse={onApplyResponse}
        onExecutarAcao={onExecutarAcao}
        onReenviarMensagem={onReenviarMensagem}
      />,
    )

    fireEvent.click(screen.getByTitle('Reenviar esta solicitação'))
    fireEvent.click(screen.getByTitle('Copiar resposta'))
    fireEvent.click(screen.getByTitle('Inserir resposta na posição atual do cursor'))

    expect(onReenviarMensagem).toHaveBeenCalledWith('usuario-1')
    expect(window.ipcAPI.ia.copiarResposta).toHaveBeenCalledWith('Resposta pronta')
    expect(onApplyResponse).toHaveBeenCalledWith(mensagens[1])
  })

  it('encaminha ações prontas do escopo selecionado', () => {
    const onExecutarAcao = vi.fn()
    render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        onExecutarAcao={onExecutarAcao}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clareza' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ortografia' }))

    expect(onExecutarAcao).toHaveBeenNthCalledWith(1, 'clareza')
    expect(onExecutarAcao).toHaveBeenNthCalledWith(2, 'ortografia')
  })

  it('permite destacar, recolher e fechar o painel pelo cabeçalho', () => {
    const onDestacar = vi.fn()
    const onRecolher = vi.fn()
    const onFechar = vi.fn()
    render(
      <AssistenteIaPanel
        secaoTitulo="Documento completo"
        editorId="laudo-single-editor"
        messages={[]}
        onSendMessage={vi.fn()}
        onApplyResponse={vi.fn()}
        onDestacar={onDestacar}
        onRecolher={onRecolher}
        onFechar={onFechar}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Destacar Assistente IA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Recolher Assistente IA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onDestacar).toHaveBeenCalledTimes(1)
    expect(onRecolher).toHaveBeenCalledTimes(1)
    expect(onFechar).toHaveBeenCalledTimes(1)
  })
})
