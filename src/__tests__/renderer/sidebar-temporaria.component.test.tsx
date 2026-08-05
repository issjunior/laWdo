import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))

function LeitorSidebar() {
  const {
    state,
    setTemporariamenteRecolhida,
    toggleSidebar,
  } = useSidebar()

  return (
    <>
      <span data-testid="estado-sidebar">{state}</span>
      <button onClick={() => setTemporariamenteRecolhida(true)}>Recolher temporariamente</button>
      <button onClick={() => setTemporariamenteRecolhida(false)}>Remover recolhimento</button>
      <button onClick={toggleSidebar}>Alternar manualmente</button>
    </>
  )
}

describe('recolhimento temporário da sidebar', () => {
  beforeEach(() => {
    document.cookie = 'sidebar_state=; max-age=0; path=/'
  })

  it('recolhe sem alterar o cookie e restaura a preferência anterior', () => {
    render(<SidebarProvider defaultOpen><LeitorSidebar /></SidebarProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Recolher temporariamente' }))
    expect(screen.getByTestId('estado-sidebar')).toHaveTextContent('collapsed')
    expect(document.cookie).not.toContain('sidebar_state=')

    fireEvent.click(screen.getByRole('button', { name: 'Remover recolhimento' }))
    expect(screen.getByTestId('estado-sidebar')).toHaveTextContent('expanded')
  })

  it('trata a expansão manual durante o dock como substituição explícita', () => {
    render(<SidebarProvider defaultOpen={false}><LeitorSidebar /></SidebarProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Recolher temporariamente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Alternar manualmente' }))
    expect(screen.getByTestId('estado-sidebar')).toHaveTextContent('expanded')
    expect(document.cookie).toContain('sidebar_state=true')

    fireEvent.click(screen.getByRole('button', { name: 'Recolher temporariamente' }))
    expect(screen.getByTestId('estado-sidebar')).toHaveTextContent('collapsed')
  })
})
