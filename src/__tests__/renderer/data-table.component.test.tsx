import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import type { DefinicaoColunaTabela } from '@/components/data-table/data-table-features'

interface RegistroTeste {
  codigo: number
  nome: string
}

const registros: RegistroTeste[] = [
  { codigo: 30, nome: 'Zeta' },
  { codigo: 20, nome: 'Beta' },
  { codigo: 10, nome: 'Alfa' },
  ...Array.from({ length: 9 }, (_, indice) => ({
    codigo: indice + 1,
    nome: `Registro ${indice + 1}`,
  })),
]

const colunas: DefinicaoColunaTabela<RegistroTeste>[] = [
  {
    accessorKey: 'nome',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nome" />,
  },
  {
    accessorKey: 'codigo',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
  },
  {
    id: 'dobro',
    accessorFn: (registro) => registro.codigo * 2,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Dobro" />,
  },
]

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('DataTable', () => {
  it('filtra valores textuais, numéricos e calculados e apresenta a contagem filtrada', () => {
    render(<DataTable columns={colunas} data={registros} searchPlaceholder="Buscar registros" />)

    const busca = screen.getByPlaceholderText('Buscar registros')
    fireEvent.change(busca, { target: { value: 'Beta' } })
    expect(screen.getByText('1 registro(s)')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()

    fireEvent.change(busca, { target: { value: '20' } })
    expect(screen.getByText('Beta')).toBeInTheDocument()

    fireEvent.change(busca, { target: { value: '40' } })
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('ordena, alterna a visibilidade e pagina os registros', async () => {
    render(<DataTable columns={colunas} data={registros} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Nome' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Crescente' }))

    const linhas = within(screen.getByRole('table')).getAllByRole('row')
    expect(within(linhas[1]).getByText('Alfa')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Código' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ocultar' }))
    expect(screen.queryByRole('button', { name: 'Código' })).not.toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Colunas' }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'codigo' }))
    expect(screen.getByRole('button', { name: 'Código' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.getByText('Pág 2 de 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: 'Itens por página' }))
    fireEvent.click(await screen.findByRole('option', { name: '20' }))
    expect(screen.getByText('Pág 1 de 1')).toBeInTheDocument()
  })

  it('fixa e desafixa uma linha sem exigir a funcionalidade de fixação', () => {
    const { rerender } = render(<DataTable columns={colunas} data={registros} enableRowPinning />)

    fireEvent.click(screen.getAllByTitle('Fixar no topo')[0])
    expect(screen.getByTitle('Remover fixação')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Remover fixação'))
    expect(screen.queryByTitle('Remover fixação')).not.toBeInTheDocument()

    rerender(<DataTable columns={colunas} data={registros} />)
    expect(screen.queryByTitle('Fixar no topo')).not.toBeInTheDocument()
  })
})
