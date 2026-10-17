import * as React from "react"
import { z } from "zod"
import { createPortal } from "react-dom"
import {
  ColumnFiltersState,
  ColumnVisibilityState,
  type RowData,
  RowPinningState,
  SortingState,
  flexRender,
  useTable,
} from "@tanstack/react-table"
import { Pin, PinOff, Search, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTablePagination } from "./data-table-pagination"
import {
  type DefinicaoColunaTabela,
  recursosTabela,
} from "./data-table-features"

interface DataTableProps<TData extends RowData> {
  columns: DefinicaoColunaTabela<TData>[]
  data: TData[]
  /** Coluna a ser usada para o filtro global de busca (ex: "numero" ou "rep_numero") */
  searchColumn?: string
  /** Placeholder do campo de busca */
  searchPlaceholder?: string
  /** Visibilidade inicial das colunas (colunas com false iniciam ocultas) */
  initialColumnVisibility?: ColumnVisibilityState
  /** Oculta o campo de busca global */
  hideSearch?: boolean
  /** Ordenação inicial [{ id: "coluna", desc: true/false }] */
  defaultSorting?: SortingState
  /** Habilita row pinning (fixar linhas no topo/base) com botão Pin/PinOff por linha */
  enableRowPinning?: boolean
  chavePreferencias?: string
  densidade?: "compacta" | "confortavel"
  preencherAltura?: boolean
  fixarPrimeiraColuna?: boolean
  /** Elemento externo onde o controle de colunas deve aparecer */
  destinoControleColunas?: HTMLElement | null
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  searchColumn: _searchColumn = "numero",
  searchPlaceholder = "Buscar...",
  initialColumnVisibility = {},
  hideSearch = false,
  defaultSorting = [],
  enableRowPinning = false,
  chavePreferencias,
  densidade = "confortavel",
  preencherAltura = false,
  fixarPrimeiraColuna = false,
  destinoControleColunas = null,
}: DataTableProps<TData>) {
  const [preferencias] = React.useState(() => {
    if (!chavePreferencias) return null
    try {
      const salvo: unknown = JSON.parse(localStorage.getItem(chavePreferencias) ?? "null")
      const validacao = z.object({
        ordenacao: z.array(z.object({ id: z.string(), desc: z.boolean() })).max(columns.length),
        visibilidade: z.record(z.string(), z.boolean()),
      }).safeParse(salvo)
      if (!validacao.success) return null
      const colunasPermitidas = new Map(columns.map(coluna => [
        coluna.id ?? ("accessorKey" in coluna ? String(coluna.accessorKey) : ""), coluna,
      ]))
      const ordenacao = validacao.data.ordenacao.filter(item => colunasPermitidas.has(item.id))
      const visibilidade = Object.fromEntries(Object.entries(validacao.data.visibilidade).filter(([id]) =>
        colunasPermitidas.has(id) && colunasPermitidas.get(id)?.enableHiding !== false
      ))
      return {
        ordenacao: validacao.data.ordenacao.length > 0 && ordenacao.length === 0 ? defaultSorting : ordenacao,
        visibilidade: { ...initialColumnVisibility, ...visibilidade },
      }
    } catch {
      return null
    }
  })
  const [sorting, setSorting] = React.useState<SortingState>(preferencias?.ordenacao ?? defaultSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(preferencias?.visibilidade ?? initialColumnVisibility)
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowPinning, setRowPinning] = React.useState<RowPinningState>({ top: [], bottom: [] })

  React.useEffect(() => {
    if (!chavePreferencias) return
    try {
      localStorage.setItem(chavePreferencias, JSON.stringify({ ordenacao: sorting, visibilidade: columnVisibility }))
    } catch {
      // O armazenamento indisponível não impede o uso da tabela na sessão atual.
    }
  }, [chavePreferencias, sorting, columnVisibility])

  const table = useTable({
    features: recursosTabela,
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowPinningChange: setRowPinning,
    enableRowPinning,
    keepPinnedRows: true,
    globalFilterFn: "incluiTexto",
    defaultColumn: {
      sortFn: "alfanumerico",
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowPinning,
    },
  })

  const controleColunas = (
    <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={destinoControleColunas ? undefined : "ml-auto"}>
              <Settings2 className="mr-2 h-4 w-4" />
              Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Alternar colunas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const headerTitle =
                  typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {headerTitle}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div data-densidade={densidade} className={preencherAltura ? "flex min-h-0 min-w-0 flex-1 flex-col gap-2" : "space-y-4"}>
      {(!hideSearch || !destinoControleColunas) && (
        <div className="flex shrink-0 items-center gap-3">
          {!hideSearch && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(String(event.target.value))}
                className="pl-8"
              />
            </div>
          )}
          {!destinoControleColunas && controleColunas}
        </div>
      )}
      {destinoControleColunas && createPortal(controleColunas, destinoControleColunas)}

      {/* Tabela */}
      <div className={preencherAltura ? "min-h-0 flex-1 overflow-hidden rounded-md border" : "rounded-md border"}>
        <Table containerClassName={preencherAltura ? "h-full overscroll-contain" : undefined}
          className={[
            densidade === "compacta" ? "[&_td]:px-3 [&_td]:py-2 [&_th]:h-9 [&_th]:px-3" : "",
            fixarPrimeiraColuna ? "min-w-[54rem] [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-card [&_td:first-child]:transition-colors [&_tr:hover_td:first-child]:bg-[color-mix(in_srgb,hsl(var(--muted))_50%,hsl(var(--card)))] [&_tr[data-state=selected]_td:first-child]:bg-muted [&_th:first-child]:left-0 [&_th:first-child]:z-30" : "",
          ].join(" ")}>
          <TableHeader className={preencherAltura ? "[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-card" : undefined}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {enableRowPinning && <TableHead className="w-10" />}
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getTopRows().map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="bg-muted/50 border-b-2 border-primary/20"
                  >
                    <TableCell className="w-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => row.pin(false)}
                        title="Remover fixação"
                      >
                        <PinOff size={12} className="text-muted-foreground" />
                      </Button>
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {table.getTopRows().length > 0 && (
                  <TableRow className="h-2 bg-transparent hover:bg-transparent">
                    <TableCell colSpan={columns.length + 1} className="p-0 border-b-2 border-border" />
                  </TableRow>
                )}
                {table.getCenterRows().map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {enableRowPinning && (
                      <TableCell className="w-10">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => row.pin("top")}
                          title="Fixar no topo"
                        >
                          <Pin size={12} className="text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {table.getBottomRows().length > 0 && (
                  <TableRow className="h-2 bg-transparent hover:bg-transparent">
                    <TableCell colSpan={columns.length + 1} className="p-0 border-t-2 border-border" />
                  </TableRow>
                )}
                {table.getBottomRows().map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="bg-muted/50 border-t-2 border-primary/20"
                  >
                    <TableCell className="w-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => row.pin(false)}
                        title="Remover fixação"
                      >
                        <PinOff size={12} className="text-muted-foreground" />
                      </Button>
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhum resultado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <DataTablePagination table={table} />
    </div>
  )
}
