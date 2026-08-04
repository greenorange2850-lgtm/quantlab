import { useEffect, useRef } from 'react'
import { useLatestBacktestDetail, useBacktestDetail } from '@/api/queries/backtest-details'
import { getBacktestDetail, getLatestBacktestDetail } from '@/backtests/detail-archive'
import { getResearchSession } from '@/research/session-archive'
import { useAppStore } from '@/stores/app.store'
import { useBacktestStore } from '@/stores/backtest.store'
import { useResearchStore } from '@/stores/research.store'
import { toStrategyViewModel } from '@/strategies'

/**
 * Resolve the backtest detail that should restore onto the Dashboard.
 * Prefer the active Strategy's winning backtest over an arbitrary "latest" detail
 * so Random Search → Strategy → Dashboard stays coherent.
 */
export function resolveActiveStrategyBacktestId(
  activeStrategyId: string | null,
): string | null {
  if (!activeStrategyId) return null
  const entry = getResearchSession(activeStrategyId)
  if (!entry) return null
  return toStrategyViewModel(entry).bestBacktestId
}

/**
 * On app startup / refresh: restore the currently active Strategy's winning
 * backtest (falling back to the latest detail archive entry). Research sessions
 * hydrate only as an internal persistence detail for the active Strategy.
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

  const activeStrategyId = useAppStore((state) => state.activeStrategyId)
  const strategyBacktestId = resolveActiveStrategyBacktestId(activeStrategyId)

  const needsHydrate = !hasBacktest && !isRunning && (!hasAttempted || Boolean(sessionHydrateError))
  const hydrateEnabled = needsHydrate || isHydratingSession

  // Prefer active Strategy's winning detail; also load latest as fallback.
  const strategyDetailQuery = useBacktestDetail(
    hydrateEnabled && strategyBacktestId ? strategyBacktestId : null,
  )
  const latestBacktest = useLatestBacktestDetail(hydrateEnabled)

  const appliedDetailId = useRef<string | null>(null)
  const appliedStrategyId = useRef<string | null>(null)

  useEffect(() => {
    if (hasBacktest || isRunning) return
    if (hasAttempted && !sessionHydrateError && !isHydratingSession) return

    const strategyLoading =
      Boolean(strategyBacktestId) &&
      (strategyDetailQuery.isLoading || strategyDetailQuery.isFetching)
    const latestLoading = latestBacktest.isLoading || latestBacktest.isFetching

    if (strategyLoading || (!strategyBacktestId && latestLoading)) {
      if (!isHydratingSession) markSessionHydrateIdle()
      return
    }

    // Resolve detail: active Strategy winner → sync archive → latest archive.
    let detail =
      (strategyBacktestId
        ? strategyDetailQuery.data ?? getBacktestDetail(strategyBacktestId)
        : null) ??
      latestBacktest.data ??
      getLatestBacktestDetail()

    if (!detail) {
      if (latestBacktest.isError && !strategyBacktestId) {
        const message =
          latestBacktest.error instanceof Error
            ? latestBacktest.error.message
            : 'Failed to restore previous strategy'
        markSessionHydrateFailed(message)
        return
      }
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
    strategyBacktestId,
    strategyDetailQuery.isLoading,
    strategyDetailQuery.isFetching,
    strategyDetailQuery.data,
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

  // Hydrate research store from the active Strategy only (internal persistence).
  // Do not restore an arbitrary "latest research session".
  useEffect(() => {
    if (!activeStrategyId) return
    if (appliedStrategyId.current === activeStrategyId) return
    const entry = getResearchSession(activeStrategyId)
    if (!entry) return
    appliedStrategyId.current = activeStrategyId
    hydrateResearch(entry)
  }, [activeStrategyId, hydrateResearch])
}
