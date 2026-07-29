import type { BacktestReport } from '../analytics/types.js'
import type { RandomSearchConstraints, ScoringObjective } from './types.js'

/** Read an existing summary metric — no new formula. */
export function scoreFromReport(report: BacktestReport, objective: ScoringObjective): number {
  switch (objective) {
    case 'netProfit':
      return report.summary.netProfit
    case 'profitFactor':
      return report.summary.profitFactor
    case 'winRate':
      return report.summary.winRate
    case 'expectancy':
      return report.summary.expectancy
  }
}

export function passesConstraints(
  report: BacktestReport,
  constraints: RandomSearchConstraints | undefined,
): boolean {
  if (!constraints) return true

  if (
    constraints.maxDrawdown !== undefined &&
    report.summary.maxDrawdown > constraints.maxDrawdown
  ) {
    return false
  }

  if (
    constraints.minimumTrades !== undefined &&
    report.summary.totalTrades < constraints.minimumTrades
  ) {
    return false
  }

  if (
    constraints.minimumProfitFactor !== undefined &&
    report.summary.profitFactor < constraints.minimumProfitFactor
  ) {
    return false
  }

  return true
}
