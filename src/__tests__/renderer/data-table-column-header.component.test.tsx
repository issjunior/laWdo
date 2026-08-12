import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'

describe('DataTableColumnHeader', () => {
  it('encaminha ordenação crescente, decrescente e ocultação da coluna', async () => {
    const coluna = {
      getCanSort: vi.fn().mockReturnValue(true),
      getIsSorted: vi.fn().mockReturnValue(false),
      toggleSorting: vi.fn(),
      toggleVisibility: vi.fn(),
    }

    render(<DataTableColumnHeader column={coluna as never} title="Data" />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Data' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Crescente' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Data' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Decrescente' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Data' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ocultar' }))

    expect(coluna.toggleSorting).toHaveBeenNthCalledWith(1, false)
    expect(coluna.toggleSorting).toHaveBeenNthCalledWith(2, true)
    expect(coluna.toggleVisibility).toHaveBeenCalledWith(false)
  })

  it('apresenta apenas o título quando a coluna não pode ser ordenada', () => {
    render(
      <DataTableColumnHeader
        column={{ getCanSort: () => false } as never}
        title="Identificador"
      />,
    )

    expect(screen.getByText('Identificador')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
