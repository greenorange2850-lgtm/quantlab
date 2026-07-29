import { create } from 'zustand'
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

interface BacktestState {
  dashboard: DashboardData
  report: BacktestReport | null
  isRunning: boolean
  error: string | null
  lastParams: RunBacktestPipelineParams
  runBacktest: (params?: Partial<RunBacktestPipelineParams>) => Promise<void>
  hydrateRecentBacktests: (items: BacktestSummary[]) => void
  clearError: () => void
}

export const useBacktestStore = create<BacktestState>((set, get) => ({
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
}))
