import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  RowPinningState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Coluna a ser usada para o filtro global de busca (ex: "numero" ou "rep_numero") */
  searchColumn?: string
  /** Placeholder do campo de busca */
  searchPlaceholder?: string
  /** Visibilidade inicial das colunas (colunas com false iniciam ocultas) */
  initialColumnVisibility?: VisibilityState
  /** Oculta o campo de busca global */
  hideSearch?: boolean
  /** Ordenação inicial [{ id: "coluna", desc: true/false }] */
  defaultSorting?: SortingState
  /** Habilita row pinning (fixar linhas no topo/base) com botão Pin/PinOff por linha */
  enableRowPinning?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchColumn: _searchColumn = "numero",
  searchPlaceholder = "Buscar...",
  initialColumnVisibility = {},
  hideSearch = false,
  defaultSorting = [],
  enableRowPinning = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility)
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowPinning, setRowPinning] = React.useState<RowPinningState>({ top: [], bottom: [] })

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowPinningChange: setRowPinning,
    enableRowPinning,
    keepPinnedRows: true,
    globalFilterFn: "auto",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowPinning,
    },
  })

  return (
    <div className="space-y-4">
      {/* Barra de ferramentas */}
      <div className="flex items-center gap-3">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
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
      </div>

      {/* Tabela */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
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
