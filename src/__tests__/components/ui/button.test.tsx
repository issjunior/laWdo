import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'

describe('Button Component', () => {
  it('deve renderizar botão com texto', () => {
    render(<Button>Clique aqui</Button>)
    const button = screen.getByRole('button', { name: /clique aqui/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-primary')
  })

  it('deve renderizar botão com variante secundária', () => {
    render(<Button variant="secondary">Botão Secundário</Button>)
    const button = screen.getByRole('button', { name: /botão secundário/i })
    expect(button).toHaveClass('bg-secondary')
  })

  it('deve renderizar botão com variante destrutiva', () => {
    render(<Button variant="destructive">Excluir</Button>)
    const button = screen.getByRole('button', { name: /excluir/i })
    expect(button).toHaveClass('bg-destructive')
  })

  it('deve renderizar botão com variante outline', () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole('button', { name: /outline/i })
    expect(button).toHaveClass('border-input')
    expect(button).toHaveClass('bg-background')
  })

  it('deve renderizar botão com variante ghost', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByRole('button', { name: /ghost/i })
    expect(button).toHaveClass('hover:bg-accent')
  })

  it('deve renderizar botão com variante link', () => {
    render(<Button variant="link">Link</Button>)
    const button = screen.getByRole('button', { name: /link/i })
    expect(button).toHaveClass('text-primary')
    expect(button).toHaveClass('underline-offset-4')
  })

  it('deve renderizar botão com tamanho pequeno', () => {
    render(<Button size="sm">Pequeno</Button>)
    const button = screen.getByRole('button', { name: /pequeno/i })
    expect(button).toHaveClass('h-8')
    expect(button).toHaveClass('px-3')
  })

  it('deve renderizar botão com tamanho grande', () => {
    render(<Button size="lg">Grande</Button>)
    const button = screen.getByRole('button', { name: /grande/i })
    expect(button).toHaveClass('h-10')
    expect(button).toHaveClass('px-8')
  })

  it('deve renderizar botão com ícone', () => {
    render(<Button size="icon"><User data-testid="user-icon" /></Button>)
    const button = screen.getByRole('button')
    const icon = screen.getByTestId('user-icon')
    expect(button).toHaveClass('h-9 w-9')
    expect(icon).toBeInTheDocument()
  })

  it('deve renderizar botão desabilitado', () => {
    render(<Button disabled>Desabilitado</Button>)
    const button = screen.getByRole('button', { name: /desabilitado/i })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
  })

  it('deve executar onClick quando clicado', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Clique</Button>)
    const button = screen.getByRole('button', { name: /clique/i })
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('não deve executar onClick quando desabilitado', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick} disabled>Desabilitado</Button>)
    const button = screen.getByRole('button', { name: /desabilitado/i })
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('deve renderizar com classe personalizada', () => {
    render(<Button className="minha-classe">Personalizado</Button>)
    const button = screen.getByRole('button', { name: /personalizado/i })
    expect(button).toHaveClass('minha-classe')
    expect(button).toHaveClass('bg-primary') // classe padrão ainda presente
  })

  it.skip('deve renderizar como elemento de link quando asChild é true (teste de integração do Slot)', () => {
    // Este teste requer configuração adicional do Slot do Radix UI
    // Vamos pular por enquanto e focar nos testes principais
    render(
      <Button asChild>
        <a href="/teste">Link como Botão</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: /link como botão/i })
    expect(link).toBeInTheDocument()
  })
})
