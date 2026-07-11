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
import { ArrowUpDown, Search, ChevronLeft, ChevronRight, Eye, MoreHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import type { BacktestSummary, BacktestStatus } from '@/types'

interface RecentBacktestsTableProps {
  data: BacktestSummary[]
}

const statusVariant: Record<BacktestStatus, 'success' | 'accent' | 'danger' | 'warning' | 'outline'> = {
  completed: 'success',
  running: 'accent',
  failed: 'danger',
  queued: 'warning',
  cancelled: 'outline',
}

export function RecentBacktestsTable({ data }: RecentBacktestsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<BacktestSummary>[]>(
    () => [
      {
        accessorKey: 'version',
        header: 'Version',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ getValue }) => (
          <span className="text-xs text-muted">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'market',
        header: 'Market',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="text-[10px] font-mono">
            {getValue() as string}
          </Badge>
        ),
      },
      {
        accessorKey: 'timeframe',
        header: 'TF',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'trades',
        header: 'Trades',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: 'winRate',
        header: 'Win Rate',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{(getValue() as number).toFixed(1)}%</span>
        ),
      },
      {
        accessorKey: 'profitFactor',
        header: 'PF',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{(getValue() as number).toFixed(2)}</span>
        ),
      },
      {
        accessorKey: 'maxDrawdown',
        header: 'Max DD',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono text-danger">
            {formatPercent(getValue() as number)}
          </span>
        ),
      },
      {
        accessorKey: 'netProfit',
        header: 'Net Profit',
        cell: ({ getValue }) => {
          const v = getValue() as number
          return (
            <span className={cn('text-xs font-mono font-medium', v >= 0 ? 'text-success' : 'text-danger')}>
              {formatCurrency(v)}
            </span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as BacktestStatus
          return (
            <Badge variant={statusVariant[status]} className="text-[10px] capitalize">
              {status}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: () => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
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
    initialState: { pagination: { pageSize: 6 } },
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
    >
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent Backtests</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search backtests..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-48 pl-9 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-border">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-2.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        {header.isPlaceholder ? null : (
                          <button
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
                {table.getRowModel().rows.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + i * 0.03 }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {table.getFilteredRowModel().rows.length} backtests total
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
