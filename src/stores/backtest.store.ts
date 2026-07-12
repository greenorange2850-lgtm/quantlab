import { create } from 'zustand'
import type { DashboardData } from '@trading-os/shared'
import type { BacktestReport } from '@/core/analytics/types'
import {
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
  clearError: () => void
}

export const useBacktestStore = create<BacktestState>((set, get) => ({
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
      const dashboard = mapPipelineResultToDashboard(
        pipelineResult,
        get().dashboard.recentBacktests,
      )

      set({
        dashboard,
        report: pipelineResult.report,
        isRunning: false,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Backtest failed'
      set({ isRunning: false, error: message })
    }
  },
}))
