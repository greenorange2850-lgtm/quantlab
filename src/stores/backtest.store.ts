import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { DashboardData } from '@trading-os/shared'
import type { BacktestReport } from '@/core/analytics/types'
import {
  applyOptimisticHistoryEntry,
  markHistoryEntryNotSaved,
  persistBacktestSummary,
  reconcileHistoryFromServer,
  fetchBacktestHistory,
} from '@/api/queries/backtests'
import {
  buildCreateBacktestRequest,
  createBacktestSummaryFromReport,
  createEmptyDashboard,
  defaultBacktestPipelineParams,
  mapPipelineResultToDashboard,
  runBacktestPipeline,
  type RunBacktestPipelineParams,
} from '@/core/dashboard'
import {
  BACKTEST_STORE_PERSIST_NAME,
  STORE_PERSIST_VERSION,
  getPersistStorage,
  partializeBacktestState,
} from './persistence'

interface BacktestState {
  /**
   * Session-derived presentation model from the last successful run.
   * Server history is owned by TanStack Query — not stored here.
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
          const request = buildCreateBacktestRequest(pipelineResult)

          // Session dashboard only — history lives in the Query cache.
          const dashboard = mapPipelineResultToDashboard(pipelineResult, [])

          // Optimistic history row: saving…
          applyOptimisticHistoryEntry(summary, request)

          set({
            dashboard,
            report: pipelineResult.report,
            isRunning: false,
          })

          try {
            await persistBacktestSummary(request)
            const serverHistory = await fetchBacktestHistory()
            reconcileHistoryFromServer(serverHistory)
          } catch {
            // Keep session results; mark the optimistic row as not saved for retry.
            markHistoryEntryNotSaved(summary.id, request)
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
