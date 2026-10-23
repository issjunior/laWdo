import { useEffect, useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { obterLarguraMinimaNecessaria, PainelLateralRedimensionavel } from '@/components/laudo/PainelLateralRedimensionavel'
import { AtalhosLaudoDialog } from '@/components/laudo/AtalhosLaudoDialog'

describe('PainelLateralRedimensionavel', () => {
  it.each(['botão', 'Escape'])('abre o guia, fecha por %s e devolve o foco ao botão do trilho', async fechamento => {
    function PaginaTeste() {
      const [aberto, setAberto] = useState(false)
      return <>
        <PainelLateralRedimensionavel tipo={null} chavePersistencia="atalhos-teste" larguraPadrao={460}
          larguraMinima={360} larguraMaxima={640} recolhido={false} iaDestacada={false}
          ilustracoesEmJanela={false} operacaoEmAndamento={false} onAlternarPainelIa={vi.fn()}
          onAlternarPainelIlustracoes={vi.fn()} onReindexarSecoes={vi.fn()}
          onAbrirAtalhos={() => setAberto(true)} conteudoPainel={null}><div>Texto do laudo</div></PainelLateralRedimensionavel>
        <AtalhosLaudoDialog aberto={aberto} onAbertoChange={setAberto} />
      </>
    }
    render(<PaginaTeste />)
    const botao = screen.getByRole('button', { name: 'Atalhos do laudo' })
    botao.focus()
    fireEvent.click(botao)
    const dialogo = await screen.findByRole('dialog', { name: 'Atalhos para elaborar o laudo' })
    expect(within(dialogo).getAllByRole('columnheader').map(coluna => coluna.textContent)).toEqual(['Atalho', 'Descrição'])
    for (const nome of ['Busca no laudo', 'Salvar', 'Edição de texto', 'Formatação e editor']) {
      expect(within(dialogo).getByRole('heading', { name: nome })).toBeInTheDocument()
    }
    expect(within(dialogo).getByText('Com foco na página, fora da área de texto do editor.')).toBeInTheDocument()
    expect(within(dialogo).getByText(/No modo por seções/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/botão “Localizar e substituir”/)).toBeInTheDocument()
    expect(within(dialogo).getByRole('region', { name: 'Lista de atalhos' })).toHaveClass('min-h-0', 'overflow-y-auto')
    expect(dialogo).toHaveClass('max-h-[85vh]', 'max-w-3xl')
    if (fechamento === 'botão') fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    else fireEvent.keyDown(dialogo, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(botao).toHaveFocus())
    expect(screen.getByText('Texto do laudo')).toBeInTheDocument()
  })

  it('abre o primeiro painel sem remontar o editor', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    let montagensEditor = 0

    function EditorTeste() {
      useEffect(() => {
        montagensEditor += 1
      }, [])
      return <div>Editor</div>
    }

    const propriedades = {
      chavePersistencia: 'painel-teste',
      larguraPadrao: 460,
      larguraMinima: 360,
      larguraMaxima: 640,
      recolhido: false,
      iaDestacada: false,
      ilustracoesEmJanela: false,
      operacaoEmAndamento: false,
      onAlternarPainelIa: vi.fn(),
      onAlternarPainelIlustracoes: vi.fn(),
      onReindexarSecoes: vi.fn(),
      onAbrirAtalhos: vi.fn(),
      conteudoPainel: <div>Assistente</div>,
    }
    const { rerender } = render(
      <PainelLateralRedimensionavel {...propriedades} tipo={null}>
        <EditorTeste />
      </PainelLateralRedimensionavel>,
    )

    expect(() => rerender(
      <PainelLateralRedimensionavel {...propriedades} tipo="ia">
        <EditorTeste />
      </PainelLateralRedimensionavel>,
    )).not.toThrow()
    expect(montagensEditor).toBe(1)
  })

  it('mantém os quatro ícones acessíveis no trilho e abre as ferramentas', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    const onAlternarPainelIa = vi.fn()
    const onAlternarPainelIlustracoes = vi.fn()
    const onReindexarSecoes = vi.fn()
    const onAbrirAtalhos = vi.fn()

    render(
      <PainelLateralRedimensionavel
        tipo={null}
        chavePersistencia="painel-teste"
        larguraPadrao={460}
        larguraMinima={360}
        larguraMaxima={640}
        recolhido={false}
        iaDestacada={false}
        ilustracoesEmJanela={false}
        operacaoEmAndamento={false}
        onAlternarPainelIa={onAlternarPainelIa}
        onAlternarPainelIlustracoes={onAlternarPainelIlustracoes}
        onReindexarSecoes={onReindexarSecoes}
        onAbrirAtalhos={onAbrirAtalhos}
        conteudoPainel={null}
      >
        <div>Editor</div>
      </PainelLateralRedimensionavel>,
    )

    const botaoIa = screen.getByRole('button', { name: 'Painel de IA' })
    const botaoIlustracoes = screen.getByRole('button', { name: 'Painel de Ilustrações' })
    const botaoFerramentas = screen.getByRole('button', { name: 'Ferramentas' })
    const botaoAtalhos = screen.getByRole('button', { name: 'Atalhos do laudo' })
    expect(botaoAtalhos.previousElementSibling).toBe(botaoFerramentas)
    fireEvent.click(botaoAtalhos)
    expect(onAbrirAtalhos).toHaveBeenCalledTimes(1)
    fireEvent.click(botaoIa)
    fireEvent.click(botaoIlustracoes)
    expect(onAlternarPainelIa).toHaveBeenCalledTimes(1)
    expect(onAlternarPainelIlustracoes).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(botaoFerramentas, { button: 0, ctrlKey: false })
    const reindexarSecoes = await screen.findByRole('menuitem', { name: 'Reindexar seções' })
    fireEvent.click(reindexarSecoes)
    expect(onReindexarSecoes).toHaveBeenCalledTimes(1)
  })

  it('mantém o painel lateral fixo sem limitar a rolagem do editor', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    const { container } = render(
      <PainelLateralRedimensionavel
        tipo="ia"
        chavePersistencia="painel-teste"
        larguraPadrao={460}
        larguraMinima={360}
        larguraMaxima={640}
        recolhido={false}
        iaDestacada={false}
        ilustracoesEmJanela={false}
        operacaoEmAndamento={false}
        onAlternarPainelIa={vi.fn()}
        onAlternarPainelIlustracoes={vi.fn()}
        onReindexarSecoes={vi.fn()}
        onAbrirAtalhos={vi.fn()}
        conteudoPainel={<div>Assistente fixo</div>}
      >
        <div>Editor expansível</div>
      </PainelLateralRedimensionavel>,
    )

    const grupoRedimensionavel = container.querySelector('[data-slot="resizable-panel-group"]')

    expect(screen.getByText('Assistente fixo').parentElement).toHaveClass(
      'h-full',
      'min-h-0',
      'rounded-2xl',
      'shadow-sm',
      'motion-safe:animate-in',
    )
    expect(screen.getByText('Assistente fixo').parentElement?.parentElement).toHaveClass('sticky', 'top-0', 'self-start')
    expect(screen.getByText('Assistente fixo').parentElement).not.toHaveClass('min-h-[32rem]')
    expect(screen.getByLabelText('Painéis do laudo')).toHaveClass('sticky', 'top-0', 'rounded-xl', 'shadow-sm')
    expect(screen.getByLabelText('Painéis do laudo').parentElement).toHaveClass('gap-2', '[overflow-x:clip]')
    expect(grupoRedimensionavel).toHaveClass(
      'h-auto',
      'items-stretch',
      'min-h-0',
      '!overflow-visible',
    )
    expect(screen.getByText('Editor expansível').parentElement).not.toHaveClass('overflow-y-auto')
  })

  it('limita a altura do painel ao espaço visível abaixo de sua posição', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    const conteudoPrincipal = document.createElement('main')
    conteudoPrincipal.id = 'conteudo-principal'
    conteudoPrincipal.getBoundingClientRect = () => new DOMRect(0, 100, 1200, 700)
    document.body.append(conteudoPrincipal)

    try {
      render(
        <PainelLateralRedimensionavel
          tipo="ia"
          chavePersistencia="painel-teste"
          larguraPadrao={460}
          larguraMinima={360}
          larguraMaxima={640}
          recolhido={false}
          iaDestacada={false}
          ilustracoesEmJanela={false}
          operacaoEmAndamento={false}
          onAlternarPainelIa={vi.fn()}
          onAlternarPainelIlustracoes={vi.fn()}
          onReindexarSecoes={vi.fn()}
          onAbrirAtalhos={vi.fn()}
          conteudoPainel={<div>Assistente visível</div>}
        >
          <div>Editor</div>
        </PainelLateralRedimensionavel>,
      )

      const painel = screen.getByText('Assistente visível').parentElement
      const painelRedimensionavel = painel?.parentElement
      expect(painel).not.toBeNull()
      painel!.getBoundingClientRect = () => new DOMRect(800, 220, 400, 400)

      fireEvent.scroll(conteudoPrincipal)

      expect(painelRedimensionavel).toHaveStyle({ height: '580px' })
    } finally {
      conteudoPrincipal.remove()
    }
  })

  it('define uma largura mínima que preserva editor, painel e trilho', () => {
    expect(obterLarguraMinimaNecessaria(360)).toBe(976)
    expect(obterLarguraMinimaNecessaria(320)).toBe(936)
  })
})
