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
import {
  BACKTEST_STORE_PERSIST_NAME,
  STORE_PERSIST_VERSION,
  getPersistStorage,
  partializeBacktestState,
} from './persistence'

interface BacktestState {
  /**
   * Derived presentation model from the last successful run.
   * Includes server-owned `recentBacktests` (hydrated from GET /backtests).
   * Not persisted.
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
  /** Replace server-owned history in the dashboard view model. */
  hydrateRecentBacktests: (items: BacktestSummary[]) => void
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

      hydrateRecentBacktests: (items) => {
        set((state) => ({
          dashboard: {
            ...state.dashboard,
            recentBacktests: items.slice(0, 12),
          },
        }))
      },

      runBacktest: async (overrides = {}) => {
        const params = { ...get().lastParams, ...overrides }
        set({ isRunning: true, error: null, lastParams: params })

        try {
          const pipelineResult = await runBacktestPipeline(params)

          // Optimistic UI: update dashboard immediately with local history prepend.
          const dashboard = mapPipelineResultToDashboard(
            pipelineResult,
            get().dashboard.recentBacktests,
          )

          set({
            dashboard,
            report: pipelineResult.report,
            isRunning: false,
          })

          // Persist summary; replace history from server when available.
          // Keep optimistic UI if the API is unreachable.
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
            // Optimistic history already applied — do not fail the backtest UX.
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
      // Only session preferences — never dashboard / report / recentBacktests.
      partialize: (state): ReturnType<typeof partializeBacktestState> =>
        partializeBacktestState(state),
    },
  ),
)
