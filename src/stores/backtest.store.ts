import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BacktestSummary, DashboardData } from '@trading-os/shared'
import type { BacktestReport } from '@/core/analytics/types'
import { api } from '@/api/client'
import {
  buildCreateBacktestRequest,
  createEmptyDashboard,
  defaultBacktestPipelineParams,
  mapPipelineResultToDashboard,
  runBacktestPipeline,
  type RunBacktestPipelineParams,
} from '@/core/dashboard'
import { queryBacktestDetail } from '@/api/queries/backtest-details'
import {
  BacktestDetailNotFoundError,
  listBacktestDetailsBySavedAt,
  saveBacktestDetail,
  type PersistedBacktestDetail,
} from '@/backtests/detail-archive'
import {
  buildPersistedDetail,
  restoreDashboardFromDetail,
} from '@/backtests/restore-dashboard'
import { persistBacktestReplay } from '@/features/backtest-replay'
import {
  BACKTEST_STORE_PERSIST_NAME,
  STORE_PERSIST_VERSION,
  getPersistStorage,
  partializeBacktestState,
} from './persistence'

export type BacktestViewMode = 'live' | 'restored'

interface LiveSessionSnapshot {
  dashboard: DashboardData
  report: BacktestReport | null
  lastParams: RunBacktestPipelineParams
}

interface BacktestState {
  /** Currently displayed dashboard (live or restored). */
  dashboard: DashboardData
  report: BacktestReport | null
  isRunning: boolean
  error: string | null
  lastParams: RunBacktestPipelineParams

  viewMode: BacktestViewMode
  restoredId: string | null
  isRestoring: boolean
  restoreError: string | null
  /** Latest run session — clearing a restored view returns here. */
  liveSession: LiveSessionSnapshot | null
  /** True after startup hydration from the archive (refresh survival). */
  autoRestored: boolean
  /** One-shot startup hydrate in progress (skeleton UX). */
  isHydratingSession: boolean
  sessionHydrateError: string | null
  /** Prevents duplicate auto-hydrate attempts in-session. */
  hasAttemptedSessionHydrate: boolean

  runBacktest: (params?: Partial<RunBacktestPipelineParams>) => Promise<void>
  /** Replace server-owned history in the dashboard view model. */
  hydrateRecentBacktests: (items: BacktestSummary[]) => void
  restoreBacktest: (id: string) => Promise<void>
  /** Apply a TanStack-fetched latest detail as the active session (no rerun). */
  applyStartupSession: (detail: PersistedBacktestDetail) => void
  markSessionHydrateIdle: () => void
  markSessionHydrateFailed: (message: string) => void
  markSessionHydrateEmpty: () => void
  clearSessionHydrateError: () => void
  dismissAutoRestoredBadge: () => void
  clearRestoredResult: () => void
  clearError: () => void
  clearRestoreError: () => void
}

function recentSummariesFromArchive(preferId?: string): BacktestSummary[] {
  const details = listBacktestDetailsBySavedAt()
  const summaries = details.map((detail) => detail.summary)
  if (!preferId) return summaries.slice(0, 12)

  const preferred = summaries.find((item) => item.id === preferId)
  const rest = summaries.filter((item) => item.id !== preferId)
  return (preferred ? [preferred, ...rest] : rest).slice(0, 12)
}

function lastParamsFromDetail(detail: PersistedBacktestDetail): RunBacktestPipelineParams {
  const intervalRaw = detail.context.timeframe || defaultBacktestPipelineParams.interval
  return {
    ...defaultBacktestPipelineParams,
    symbol: detail.report.config.symbol,
    interval: intervalRaw.toLowerCase(),
    initialCapital: detail.report.config.initialCapital,
    commissionPercent: detail.report.config.commissionPercent,
    positionSizePercent: detail.report.config.positionSizePercent,
    strategyName: detail.context.strategyName,
    strategyVersion: detail.context.strategyVersion,
  }
}

export const useBacktestStore = create<BacktestState>()(
  persist(
    (set, get) => ({
  dashboard: createEmptyDashboard(),
  report: null,
  isRunning: false,
  error: null,
  lastParams: defaultBacktestPipelineParams,

  viewMode: 'live',
  restoredId: null,
  isRestoring: false,
  restoreError: null,
  liveSession: null,
  autoRestored: false,
  isHydratingSession: false,
  sessionHydrateError: null,
  hasAttemptedSessionHydrate: false,

  clearError: () => set({ error: null }),
  clearRestoreError: () => set({ restoreError: null }),

  hydrateRecentBacktests: (items) => {
    set((state) => ({
      dashboard: {
        ...state.dashboard,
        recentBacktests: items.slice(0, 12),
      },
    }))
  },
  clearSessionHydrateError: () => set({ sessionHydrateError: null }),
  dismissAutoRestoredBadge: () => set({ autoRestored: false }),

  markSessionHydrateIdle: () =>
    set({
      isHydratingSession: true,
      sessionHydrateError: null,
      hasAttemptedSessionHydrate: true,
    }),

  markSessionHydrateEmpty: () =>
    set({
      isHydratingSession: false,
      sessionHydrateError: null,
      hasAttemptedSessionHydrate: true,
      autoRestored: false,
    }),

  markSessionHydrateFailed: (message) =>
    set({
      isHydratingSession: false,
      sessionHydrateError: message,
      hasAttemptedSessionHydrate: true,
    }),

  applyStartupSession: (detail) => {
    const recentBacktests = recentSummariesFromArchive(detail.id)
    const dashboard = restoreDashboardFromDetail(detail, recentBacktests)
    const lastParams = lastParamsFromDetail(detail)
    const liveSession: LiveSessionSnapshot = {
      dashboard,
      report: detail.report,
      lastParams,
    }

    set({
      dashboard,
      report: detail.report,
      lastParams,
      liveSession,
      viewMode: 'live',
      restoredId: null,
      isRestoring: false,
      restoreError: null,
      autoRestored: true,
      isHydratingSession: false,
      sessionHydrateError: null,
      hasAttemptedSessionHydrate: true,
    })
  },

  clearRestoredResult: () => {
    const live = get().liveSession
    if (!live) {
      set({
        viewMode: 'live',
        restoredId: null,
        restoreError: null,
        isRestoring: false,
      })
      return
    }

    set({
      dashboard: live.dashboard,
      report: live.report,
      lastParams: live.lastParams,
      viewMode: 'live',
      restoredId: null,
      restoreError: null,
      isRestoring: false,
    })
  },

  restoreBacktest: async (id: string) => {
    set({ isRestoring: true, restoreError: null })

    try {
      const detail = await queryBacktestDetail(id)
      const recentBacktests =
        get().liveSession?.dashboard.recentBacktests ??
        (get().dashboard.recentBacktests.length > 0
          ? get().dashboard.recentBacktests
          : recentSummariesFromArchive(id))

      const dashboard = restoreDashboardFromDetail(detail, recentBacktests)

      set({
        dashboard,
        report: detail.report,
        viewMode: 'restored',
        restoredId: id,
        isRestoring: false,
        restoreError: null,
      })
    } catch (error: unknown) {
      const message =
        error instanceof BacktestDetailNotFoundError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to restore backtest'

      set({
        isRestoring: false,
        restoreError: message,
      })
    }
  },

  runBacktest: async (overrides = {}) => {
    const params = { ...get().lastParams, ...overrides }
    set({
      isRunning: true,
      error: null,
      restoreError: null,
      sessionHydrateError: null,
      lastParams: params,
      viewMode: 'live',
      restoredId: null,
      autoRestored: false,
    })

    try {
      const pipelineResult = await runBacktestPipeline(params)
      const recentBacktests = get().dashboard.recentBacktests
      const dashboard = mapPipelineResultToDashboard(pipelineResult, recentBacktests)

      const summary = dashboard.recentBacktests[0]
      if (summary) {
        saveBacktestDetail(
          buildPersistedDetail({
            id: pipelineResult.backtestId,
            report: pipelineResult.report,
            context: pipelineResult.context,
            existingSummary: summary,
          }),
        )
        void persistBacktestReplay({
          backtestId: pipelineResult.backtestId,
          candles: pipelineResult.candles,
          trades: pipelineResult.report.trades,
          events: pipelineResult.executionEvents ?? [],
          report: pipelineResult.report,
          strategyName: pipelineResult.context.strategyName,
          strategyVersion: pipelineResult.context.strategyVersion,
          timeframe: pipelineResult.context.timeframe,
          strategyParams: pipelineResult.strategyParams,
        })
      }

      const liveSession: LiveSessionSnapshot = {
        dashboard,
        report: pipelineResult.report,
        lastParams: params,
      }

      set({
        dashboard,
        report: pipelineResult.report,
        isRunning: false,
        liveSession,
        viewMode: 'live',
        restoredId: null,
        autoRestored: false,
      })

      // Best-effort server persistence (PR #13). Keep local optimistic UI if API is down.
      try {
        const request = buildCreateBacktestRequest(pipelineResult)
        await api.post<BacktestSummary>('/backtests', request)
        const serverHistory = await api.get<BacktestSummary[]>('/backtests')
        set((state) => ({
          dashboard: {
            ...state.dashboard,
            recentBacktests: serverHistory.slice(0, 12),
          },
        }))
      } catch {
        // Local archive + optimistic history already applied.
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Backtest failed'
      set({ isRunning: false, error: message })
    }
  },
}),
    {
      name: BACKTEST_STORE_PERSIST_NAME,
      version: STORE_PERSIST_VERSION,
      storage: createJSONStorage(getPersistStorage),
      partialize: (state): ReturnType<typeof partializeBacktestState> =>
        partializeBacktestState(state),
    },
  ),
)
