import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BacktestSummary, DashboardData } from '@trading-os/shared'
import type { BacktestReport } from '@/core/analytics/types'
import { api } from '@/api/client'
import { backtestKeys } from '@/api/queries/backtests'
import {
  buildCreateBacktestRequest,
  createBacktestSummaryFromReport,
  createEmptyDashboard,
  defaultBacktestPipelineParams,
  mapPipelineResultToDashboard,
  mergeRecentBacktests,
  runBacktestPipeline,
  type RunBacktestPipelineParams,
} from '@/core/dashboard'
import { queryClient } from '@/providers/query-client'
import {
  BACKTEST_STORE_PERSIST_NAME,
  STORE_PERSIST_VERSION,
  getPersistStorage,
  partializeBacktestState,
} from './persistence'

interface BacktestState {
  /**
   * Session-derived presentation model from the last successful run.
   * Server history (`recentBacktests`) is owned by TanStack Query — not stored here.
   */
  dashboard: DashboardData
  /** Session working set from the last run — not persisted. */
  report: BacktestReport | null
  /** Ephemeral UI flag — not persisted. */
  isRunning: boolean
  /** Ephemeral UI error — not persisted. */
  error: string | null
  /** Session preference (last run form) — persisted. */
  lastParams: RunBacktestPipelineParams
  runBacktest: (params?: Partial<RunBacktestPipelineParams>) => Promise<void>
  clearError: () => void
}

function writeHistoryCache(items: BacktestSummary[]) {
  queryClient.setQueryData<BacktestSummary[]>(backtestKeys.all, items.slice(0, 50))
}

function readHistoryCache(): BacktestSummary[] {
  return queryClient.getQueryData<BacktestSummary[]>(backtestKeys.all) ?? []
}

export const useBacktestStore = create<BacktestState>()(
  persist(
    (set, get) => ({
      dashboard: createEmptyDashboard(),
      report: null,
      isRunning: false,
      error: null,
      lastParams: defaultBacktestPipelineParams,

      clearError: () => set({ error: null }),

      runBacktest: async (overrides = {}) => {
        const params = { ...get().lastParams, ...overrides }
        set({ isRunning: true, error: null, lastParams: params })

        try {
          const pipelineResult = await runBacktestPipeline(params)
          const summary = createBacktestSummaryFromReport(
            pipelineResult.report,
            pipelineResult.context,
            pipelineResult.backtestId,
          )

          // Session dashboard only — do not embed server history in the store.
          const dashboard = mapPipelineResultToDashboard(pipelineResult, [])

          // Optimistic: update Query cache (source of truth for Recent Backtests).
          writeHistoryCache(mergeRecentBacktests(summary, readHistoryCache()))

          set({
            dashboard,
            report: pipelineResult.report,
            isRunning: false,
          })

          // Persist to API; reconcile cache from server when available.
          try {
            const request = buildCreateBacktestRequest(pipelineResult)
            await api.post<BacktestSummary>('/backtests', request)
            const serverHistory = await api.get<BacktestSummary[]>('/backtests')
            writeHistoryCache(serverHistory)
          } catch {
            // Keep optimistic Query cache — do not fail the backtest UX.
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
