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
import { queryBacktestDetail } from '@/api/queries/backtest-details'
import { BacktestDetailNotFoundError, saveBacktestDetail } from '@/backtests/detail-archive'
import {
  buildPersistedDetail,
  restoreDashboardFromDetail,
} from '@/backtests/restore-dashboard'

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

  runBacktest: (params?: Partial<RunBacktestPipelineParams>) => Promise<void>
  restoreBacktest: (id: string) => Promise<void>
  clearRestoredResult: () => void
  clearError: () => void
  clearRestoreError: () => void
}

export const useBacktestStore = create<BacktestState>((set, get) => ({
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

  clearError: () => set({ error: null }),
  clearRestoreError: () => set({ restoreError: null }),

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
        get().liveSession?.dashboard.recentBacktests ?? get().dashboard.recentBacktests

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
      lastParams: params,
      viewMode: 'live',
      restoredId: null,
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
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Backtest failed'
      set({ isRunning: false, error: message })
    }
  },
}))
