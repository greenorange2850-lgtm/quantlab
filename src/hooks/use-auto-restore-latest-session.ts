import { useEffect, useRef } from 'react'
import { useLatestBacktestDetail } from '@/api/queries/backtest-details'
import { useLatestResearchSession } from '@/api/queries/research-sessions'
import { useBacktestStore } from '@/stores/backtest.store'
import { useResearchStore } from '@/stores/research.store'

/**
 * On app startup / refresh: TanStack Query loads the latest persisted
 * BacktestReport (and research session if present). Zustand only receives the
 * applied active session — no pipeline rerun, no fabricated metrics.
 */
export function useAutoRestoreLatestSession() {
  const hasAttempted = useBacktestStore((state) => state.hasAttemptedSessionHydrate)
  const hasBacktest = useBacktestStore((state) => state.dashboard.hasBacktest)
  const isRunning = useBacktestStore((state) => state.isRunning)
  const isHydratingSession = useBacktestStore((state) => state.isHydratingSession)
  const sessionHydrateError = useBacktestStore((state) => state.sessionHydrateError)
  const applyStartupSession = useBacktestStore((state) => state.applyStartupSession)
  const markSessionHydrateIdle = useBacktestStore((state) => state.markSessionHydrateIdle)
  const markSessionHydrateEmpty = useBacktestStore((state) => state.markSessionHydrateEmpty)
  const markSessionHydrateFailed = useBacktestStore((state) => state.markSessionHydrateFailed)
  const hydrateResearch = useResearchStore((state) => state.hydrateFromPersistedSession)

  const needsHydrate = !hasBacktest && !isRunning && (!hasAttempted || Boolean(sessionHydrateError))
  const latestBacktest = useLatestBacktestDetail(needsHydrate || isHydratingSession)
  const latestResearch = useLatestResearchSession(needsHydrate || isHydratingSession)

  const appliedDetailId = useRef<string | null>(null)
  const appliedResearchId = useRef<string | null>(null)

  useEffect(() => {
    if (hasBacktest || isRunning) return
    if (hasAttempted && !sessionHydrateError && !isHydratingSession) return

    if (latestBacktest.isLoading || latestBacktest.isFetching) {
      if (!isHydratingSession) markSessionHydrateIdle()
      return
    }

    if (latestBacktest.isError) {
      const message =
        latestBacktest.error instanceof Error
          ? latestBacktest.error.message
          : 'Failed to restore previous session'
      markSessionHydrateFailed(message)
      return
    }

    const detail = latestBacktest.data ?? null
    if (!detail) {
      markSessionHydrateEmpty()
      return
    }

    if (appliedDetailId.current === detail.id && hasAttempted && !sessionHydrateError) return
    appliedDetailId.current = detail.id
    applyStartupSession(detail)
  }, [
    hasBacktest,
    isRunning,
    hasAttempted,
    sessionHydrateError,
    isHydratingSession,
    latestBacktest.isLoading,
    latestBacktest.isFetching,
    latestBacktest.isError,
    latestBacktest.data,
    latestBacktest.error,
    applyStartupSession,
    markSessionHydrateIdle,
    markSessionHydrateEmpty,
    markSessionHydrateFailed,
  ])

  useEffect(() => {
    const entry = latestResearch.data
    if (!entry) return
    if (appliedResearchId.current === entry.session.id) return
    appliedResearchId.current = entry.session.id
    hydrateResearch(entry)
  }, [latestResearch.data, hydrateResearch])
}
