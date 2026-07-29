import type { BacktestSummary, DashboardData } from '@trading-os/shared'
import type { BacktestReport } from '@/core/analytics/types'
import {
  buildDashboardViewModel,
  createBacktestSummaryFromReport,
  type DashboardViewModelContext,
} from '@/core/dashboard'
import type { PersistedBacktestDetail } from './detail-archive'

/**
 * Build a dashboard view from a persisted report without rerunning the strategy
 * or recomputing analytics. Reuses the existing report → dashboard mapper.
 */
export function restoreDashboardFromDetail(
  detail: PersistedBacktestDetail,
  recentBacktests: BacktestSummary[],
): DashboardData {
  const mapped = buildDashboardViewModel(detail.report, detail.context, recentBacktests)

  // Preserve the historical list as-is (no new history row on restore).
  return {
    ...mapped,
    recentBacktests,
  }
}

export function buildPersistedDetail(input: {
  id: string
  report: BacktestReport
  context: DashboardViewModelContext
  existingSummary?: BacktestSummary
}): PersistedBacktestDetail {
  const summary =
    input.existingSummary ??
    createBacktestSummaryFromReport(input.report, input.context, input.id)

  return {
    id: input.id,
    summary,
    report: input.report,
    context: {
      strategyName: input.context.strategyName,
      strategyVersion: input.context.strategyVersion,
      timeframe: input.context.timeframe,
      // Candles optional — omit large series from persistence when absent.
      candles: input.context.candles,
    },
    savedAt: Date.now(),
  }
}

export function formatRestoredDateRange(report: BacktestReport): string | null {
  const first = report.equityCurve[0]?.time
  const last = report.equityCurve.at(-1)?.time
  if (first === undefined || last === undefined) return null

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

  return `${fmt(first)} → ${fmt(last)}`
}
