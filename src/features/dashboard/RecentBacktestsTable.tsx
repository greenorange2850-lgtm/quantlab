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
  onViewDetails?: (id: string) => void
  activeRestoredId?: string | null
  isRestoring?: boolean
}

const statusVariant: Record<BacktestStatus, 'success' | 'accent' | 'danger' | 'warning' | 'outline'> = {
  completed: 'success',
  running: 'accent',
  failed: 'danger',
  queued: 'warning',
  cancelled: 'outline',
}

function BacktestCard({
  item,
  onViewDetails,
  isActive,
  isRestoring,
}: {
  item: BacktestSummary
  onViewDetails?: (id: string) => void
  isActive?: boolean
  isRestoring?: boolean
}) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-3 rounded-lg border bg-white/[0.02] p-4',
        isActive ? 'border-accent/40' : 'border-border/60',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-medium">{item.version}</p>
          <p className="mt-0.5 text-xs text-muted">{item.date}</p>
        </div>
        <Badge variant={statusVariant[item.status]} className="shrink-0 text-[10px] capitalize">
          {item.status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          {item.market}
        </Badge>
        <span className="font-mono text-xs text-muted">{item.timeframe}</span>
        <span className="text-xs text-muted">{item.trades} trades</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</p>
          <p className="font-mono text-xs">{item.winRate.toFixed(1)}%</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">PF</p>
          <p className="font-mono text-xs">{item.profitFactor.toFixed(2)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max DD</p>
          <p className="font-mono text-xs text-danger">{formatPercent(item.maxDrawdown)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Profit</p>
          <p
            className={cn(
              'font-mono text-xs font-medium',
              item.netProfit >= 0 ? 'text-success' : 'text-danger',
            )}
          >
            {formatCurrency(item.netProfit)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 pt-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label={`View details for ${item.version}`}
          disabled={isRestoring}
          onClick={() => onViewDetails?.(item.id)}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="More actions" disabled>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function RecentBacktestsTable({
  data,
  onViewDetails,
  activeRestoredId = null,
  isRestoring = false,
}: RecentBacktestsTableProps) {
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
          <Badge variant="outline" className="font-mono text-[10px]">
            {getValue() as string}
          </Badge>
        ),
      },
      {
        accessorKey: 'timeframe',
        header: 'TF',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'trades',
        header: 'Trades',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: 'winRate',
        header: 'Win Rate',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{(getValue() as number).toFixed(1)}%</span>
        ),
      },
      {
        accessorKey: 'profitFactor',
        header: 'PF',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{(getValue() as number).toFixed(2)}</span>
        ),
      },
      {
        accessorKey: 'maxDrawdown',
        header: 'Max DD',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-danger">
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
            <span className={cn('font-mono text-xs font-medium', v >= 0 ? 'text-success' : 'text-danger')}>
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
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`View details for ${row.original.version}`}
              disabled={isRestoring}
              onClick={() => onViewDetails?.(row.original.id)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions" disabled>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [onViewDetails, isRestoring],
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

  const rows = table.getRowModel().rows

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className="min-w-0"
    >
      <Card className="min-w-0">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Recent Backtests</CardTitle>
          <div className="relative w-full min-w-0 sm:w-48">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search backtests..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-11 w-full pl-9 text-xs sm:h-8"
            />
          </div>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          <div className="space-y-3 p-4 md:hidden">
            {rows.map((row) => (
              <BacktestCard
                key={row.id}
                item={row.original}
                onViewDetails={onViewDetails}
                isActive={row.original.id === activeRestoredId}
                isRestoring={isRestoring}
              />
            ))}
            {rows.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No backtests found</p>
            )}
          </div>

          <div className="hidden min-w-0 md:block">
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-border">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {header.isPlaceholder ? null : (
                            <button
                              className="flex items-center gap-1 transition-colors hover:text-foreground"
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
                  {rows.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      className={cn(
                        'border-b border-border/50 transition-colors hover:bg-white/[0.02]',
                        row.original.id === activeRestoredId && 'bg-accent/5',
                      )}
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
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {table.getFilteredRowModel().rows.length} backtests total
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-7 sm:w-7"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-7 sm:w-7"
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
