import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '@/components/ErrorBoundary'

function ComponenteComFalha(): never {
  throw new Error('Falha simulada')
}

describe('ErrorBoundary', () => {
  it('registra uma falha de renderização e oferece recuperação pelo processo principal', () => {
    Object.assign(window.ipcAPI, {
      logError: vi.fn(),
      restartApp: vi.fn(),
    })

    render(
      <ErrorBoundary>
        <ComponenteComFalha />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'Ops! Algo deu errado' })).toBeInTheDocument()
    expect(screen.getByText('Falha simulada')).toBeInTheDocument()
    expect(window.ipcAPI.logError).toHaveBeenCalledWith(
      'renderer',
      'Erro não tratado no React',
      expect.any(Error),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar Aplicação' }))
    expect(window.ipcAPI.restartApp).toHaveBeenCalledTimes(1)

    const abrirJanela = vi.spyOn(window, 'open').mockImplementation(() => null)
    fireEvent.click(screen.getByRole('button', { name: 'Limpar Cache' }))
    expect(window.localStorage.clear).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.clear).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Reportar Erro' }))
    expect(abrirJanela).toHaveBeenCalledWith(expect.stringMatching(/^mailto:support@pcpr\.pr\.gov\.br/), '_blank')
  })

  it('usa o fallback informado pelo chamador após uma falha', () => {
    render(
      <ErrorBoundary fallback={<p>Recuperação alternativa</p>}>
        <ComponenteComFalha />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Recuperação alternativa')).toBeInTheDocument()
  })
})
