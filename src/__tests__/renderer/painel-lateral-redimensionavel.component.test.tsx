import { useEffect } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PainelLateralRedimensionavel } from '@/components/laudo/PainelLateralRedimensionavel'

describe('PainelLateralRedimensionavel', () => {
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

  it('mantém os três ícones acessíveis no trilho e abre as ferramentas', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    const onAlternarPainelIa = vi.fn()
    const onAlternarPainelIlustracoes = vi.fn()
    const onReindexarSecoes = vi.fn()

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
        conteudoPainel={null}
      >
        <div>Editor</div>
      </PainelLateralRedimensionavel>,
    )

    const botaoIa = screen.getByRole('button', { name: 'Painel de IA' })
    const botaoIlustracoes = screen.getByRole('button', { name: 'Painel de Ilustrações' })
    const botaoFerramentas = screen.getByRole('button', { name: 'Ferramentas' })
    fireEvent.click(botaoIa)
    fireEvent.click(botaoIlustracoes)
    expect(onAlternarPainelIa).toHaveBeenCalledTimes(1)
    expect(onAlternarPainelIlustracoes).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(botaoFerramentas, { button: 0, ctrlKey: false })
    const reindexarSecoes = await screen.findByRole('menuitem', { name: 'Reindexar seções' })
    fireEvent.click(reindexarSecoes)
    expect(onReindexarSecoes).toHaveBeenCalledTimes(1)
  })

  it('mantém o conteúdo lateral fixo na viewport sem limitar a altura do editor', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
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
        conteudoPainel={<div>Assistente fixo</div>}
      >
        <div>Editor expansível</div>
      </PainelLateralRedimensionavel>,
    )

    expect(screen.getByText('Assistente fixo').parentElement).toHaveClass('sticky', 'top-4')
    expect(screen.getByLabelText('Painéis do laudo')).toHaveClass('sticky', 'top-4')
  })
})
