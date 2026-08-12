import {
  type CellData,
  type Column,
  type ColumnDef,
  type RowData,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from "@tanstack/react-table"
import type { ReactTable } from "@tanstack/react-table"

export const recursosTabela = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    incluiTexto: filterFn_includesString,
  },
  sortFns: {
    alfanumerico: sortFn_alphanumeric,
  },
})

type RecursosTabela = typeof recursosTabela

export type DefinicaoColunaTabela<
  TData extends RowData,
  TValue extends CellData = CellData,
> =
  ColumnDef<RecursosTabela, TData, TValue>

export type ColunaTabela<
  TData extends RowData,
  TValue extends CellData = CellData,
> = Column<
  RecursosTabela,
  TData,
  TValue
>

export type TabelaDados<TData extends RowData> = ReactTable<RecursosTabela, TData>
