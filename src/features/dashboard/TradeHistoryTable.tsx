import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import type { DashboardTradeRow } from '@/types'

interface TradeHistoryTableProps {
  data: DashboardTradeRow[]
}

function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1000)}s`
  }

  if (durationMs < 3_600_000) {
    return `${Math.round(durationMs / 60_000)}m`
  }

  return `${(durationMs / 3_600_000).toFixed(1)}h`
}

export function TradeHistoryTable({ data }: TradeHistoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<DashboardTradeRow>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="text-[10px] font-mono">
            {getValue() as string}
          </Badge>
        ),
      },
      {
        accessorKey: 'side',
        header: 'Side',
        cell: ({ getValue }) => {
          const side = getValue() as string
          return (
            <Badge variant={side === 'long' ? 'success' : 'accent'} className="text-[10px] capitalize">
              {side}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'entryPrice',
        header: 'Entry',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{(getValue() as number).toFixed(2)}</span>
        ),
      },
      {
        accessorKey: 'exitPrice',
        header: 'Exit',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{(getValue() as number).toFixed(2)}</span>
        ),
      },
      {
        accessorKey: 'quantity',
        header: 'Quantity',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{(getValue() as number).toFixed(4)}</span>
        ),
      },
      {
        accessorKey: 'pnl',
        header: 'PnL',
        cell: ({ getValue }) => {
          const pnl = getValue() as number
          return (
            <span className={cn('text-xs font-mono', pnl >= 0 ? 'text-success' : 'text-danger')}>
              {formatCurrency(pnl)}
            </span>
          )
        },
      },
      {
        accessorKey: 'returnPercent',
        header: 'Return %',
        cell: ({ getValue }) => {
          const value = getValue() as number
          return (
            <span className={cn('text-xs font-mono', value >= 0 ? 'text-success' : 'text-danger')}>
              {formatPercent(value)}
            </span>
          )
        },
      },
      {
        accessorKey: 'durationMs',
        header: 'Duration',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{formatDuration(getValue() as number)}</span>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Trade History</CardTitle>
          <div className="relative w-full min-w-0 sm:w-48">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search trades..."
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="h-11 bg-white/[0.03] pl-9 text-xs sm:h-8"
            />
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          {data.length === 0 ? (
            <EmptyState title="No trades yet" description="Run a backtest in Strategy Lab." />
          ) : (
            <>
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b border-border">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="pb-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                          >
                            {header.isPlaceholder ? null : (
                              <button
                                type="button"
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                <ArrowUpDown className="h-3 w-3" />
                              </button>
                            )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="py-2.5">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
