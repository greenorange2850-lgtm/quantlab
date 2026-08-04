import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Library, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteStrategy, useStrategies, useStrategyArchiveReady } from '@/api/queries/strategies'
import { shouldAwaitResearchArchive } from '@/research/ui-gates'
import {
  collectStrategyFilterOptions,
  defaultStrategyFilters,
  filterAndSortStrategies,
  type StrategyListFilters,
} from '@/strategies'
import { StrategyFilters } from './components/StrategyFilters'
import { StrategyList } from './components/StrategyList'
import { StrategyLibraryEmptyState } from './components/EmptyState'

function LibrarySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/**
 * Strategy Library — primary durable object browser.
 * Backed by research-session archive + strategy metadata overlay.
 */
export function StrategyLibraryPage() {
  const archiveReady = useStrategyArchiveReady()
  const strategiesQuery = useStrategies()
  const deleteMutation = useDeleteStrategy()
  const [filters, setFilters] = useState<StrategyListFilters>(defaultStrategyFilters)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const allItems = useMemo(() => strategiesQuery.data ?? [], [strategiesQuery.data])
  const options = useMemo(() => collectStrategyFilterOptions(allItems), [allItems])
  const visibleItems = useMemo(
    () => filterAndSortStrategies(allItems, filters),
    [allItems, filters],
  )

  const handleDelete = (strategyId: string) => {
    setDeleteError(null)
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm('Delete this strategy? This cannot be undone.')
    if (!confirmed) return

    deleteMutation.mutate(strategyId, {
      onError: (error) => {
        setDeleteError(error instanceof Error ? error.message : 'Failed to delete strategy')
      },
    })
  }

  const awaitingHydration = shouldAwaitResearchArchive({
    archiveReady,
    hasData: Boolean(strategiesQuery.data),
    isPending:
      strategiesQuery.isLoading || strategiesQuery.isFetching || strategiesQuery.isPending,
  })

  if (awaitingHydration) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header />
        <LibrarySkeleton />
      </div>
    )
  }

  if (strategiesQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header />
        <Card hover={false} className="border-danger/30 bg-danger/10">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-pretty">
                {strategiesQuery.error instanceof Error
                  ? strategiesQuery.error.message
                  : 'Failed to load strategies'}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              onClick={() => void strategiesQuery.refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5">
      <Header count={allItems.filter((item) => item.lifecycle !== 'draft').length} />

      <Card hover={false}>
        <CardContent className="space-y-3 py-4">
          <StrategyFilters
            filters={filters}
            markets={options.markets}
            timeframes={options.timeframes}
            onChange={setFilters}
            disabled={allItems.length === 0}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={filters.savedOnly}
              onChange={(event) =>
                setFilters({ ...filters, savedOnly: event.target.checked })
              }
              className="rounded border-border"
            />
            Show saved strategies only
          </label>
        </CardContent>
      </Card>

      {deleteError ? (
        <Card hover={false} className="border-danger/30 bg-danger/10">
          <CardContent className="flex items-start gap-2 py-3 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="text-pretty">{deleteError}</span>
          </CardContent>
        </Card>
      ) : null}

      {allItems.length === 0 ? (
        <StrategyLibraryEmptyState />
      ) : visibleItems.length === 0 ? (
        <Card hover={false} className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium">No matching strategies</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clear filters or include drafts to see more.
            </p>
          </CardContent>
        </Card>
      ) : (
        <StrategyList
          items={visibleItems}
          deletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

function Header({ count }: { count?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white/[0.03]">
          <Library className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Strategy Library</h2>
          <p className="text-pretty text-xs text-muted-foreground">
            Saved strategies from completed research.
          </p>
          {typeof count === 'number' ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {count} strateg{count === 1 ? 'y' : 'ies'}
            </p>
          ) : null}
        </div>
      </div>
      <Link to="/optimizer" className="w-full sm:w-auto">
        <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          New Research
        </Button>
      </Link>
    </div>
  )
}
