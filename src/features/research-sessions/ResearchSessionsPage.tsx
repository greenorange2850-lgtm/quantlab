import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, History, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useDeleteResearchSession,
  useResearchSessionArchiveReady,
  useResearchSessions,
} from '@/api/queries/research-sessions'
import {
  collectFilterOptions,
  defaultSessionFilters,
  filterAndSortSessions,
  toSessionListItem,
  type SessionListFilters,
} from './session-list-model'
import { SessionFilters } from './components/SessionFilters'
import { SessionList } from './components/SessionList'
import { EmptyState } from './components/EmptyState'

function SessionsSkeleton() {
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
 * Manage archived research sessions.
 * TanStack Query owns list/delete; filters are local UI state only.
 */
export function ResearchSessionsPage() {
  const archiveReady = useResearchSessionArchiveReady()
  const sessionsQuery = useResearchSessions()
  const deleteMutation = useDeleteResearchSession()
  const [filters, setFilters] = useState<SessionListFilters>(defaultSessionFilters)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const allItems = useMemo(
    () => (sessionsQuery.data ?? []).map(toSessionListItem),
    [sessionsQuery.data],
  )
  const options = useMemo(() => collectFilterOptions(allItems), [allItems])
  const visibleItems = useMemo(
    () => filterAndSortSessions(allItems, filters),
    [allItems, filters],
  )

  const handleDelete = (sessionId: string) => {
    setDeleteError(null)
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm('Delete this research session? This cannot be undone.')
    if (!confirmed) return

    deleteMutation.mutate(sessionId, {
      onError: (error) => {
        setDeleteError(error instanceof Error ? error.message : 'Failed to delete session')
      },
    })
  }

  // Do not show “0 sessions archived” until localStorage hydrate has finished.
  const awaitingHydration =
    !archiveReady ||
    (!sessionsQuery.data && (sessionsQuery.isLoading || sessionsQuery.isFetching || sessionsQuery.isPending))

  if (awaitingHydration) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header />
        <SessionsSkeleton />
      </div>
    )
  }

  if (sessionsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header />
        <Card hover={false} className="border-danger/30 bg-danger/10">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-pretty">
                {sessionsQuery.error instanceof Error
                  ? sessionsQuery.error.message
                  : 'Failed to load research sessions'}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              onClick={() => void sessionsQuery.refetch()}
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
      <Header count={allItems.length} />

      <Card hover={false}>
        <CardContent className="space-y-3 py-4">
          <SessionFilters
            filters={filters}
            markets={options.markets}
            timeframes={options.timeframes}
            onChange={setFilters}
            disabled={allItems.length === 0}
          />
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
        <EmptyState />
      ) : visibleItems.length === 0 ? (
        <Card hover={false} className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No sessions match the current filters.
          </CardContent>
        </Card>
      ) : (
        <SessionList
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
          <History className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Research Sessions</h2>
          <p className="text-pretty text-xs text-muted-foreground">
            Browse and manage previously generated research sessions.
          </p>
          {typeof count === 'number' ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {count} session{count === 1 ? '' : 's'} archived
            </p>
          ) : null}
        </div>
      </div>
      <Link to="/optimizer" className="w-full sm:w-auto">
        <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Optimizer
        </Button>
      </Link>
    </div>
  )
}
