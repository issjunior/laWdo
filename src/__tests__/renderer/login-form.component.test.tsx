import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/flickering-grid', () => ({
  FlickeringGrid: () => <div data-testid="fundo-animado" />,
}))

import { LoginForm } from '@/components/auth/LoginForm'

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('perito.salvo')
  })

  it('restaura o último usuário e envia credenciais válidas', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onToggleTheme = vi.fn()
    render(
      <LoginForm
        loading={false}
        error={null}
        isDarkMode={false}
        onToggleTheme={onToggleTheme}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByPlaceholderText('usuario.perito')).toHaveValue('perito.salvo')
    fireEvent.change(screen.getByPlaceholderText('Digite sua senha'), { target: { value: 'senha-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ username: 'perito.salvo', senha: 'senha-segura' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Alternar tema' }))
    expect(onToggleTheme).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByPlaceholderText('Digite sua senha')).toHaveAttribute('type', 'text')
  })

  it('valida campos obrigatórios e informa erro de autenticação sem habilitar novo envio', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <LoginForm
        loading={false}
        error="Credenciais inválidas"
        isDarkMode
        onToggleTheme={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('usuario.perito'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Username é obrigatório')).toBeInTheDocument()
    expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    rerender(
      <LoginForm
        loading
        error={null}
        isDarkMode
        onToggleTheme={vi.fn()}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled()
  })
})
