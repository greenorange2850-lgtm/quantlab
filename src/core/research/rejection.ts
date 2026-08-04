import type { BacktestReport } from '../analytics/types.js'
import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type { CandidateRejectionReason, RandomSearchConstraints } from './types.js'
import { passesConstraints } from './scoring.js'

export function collectRejectionReasons(
  report: BacktestReport,
  constraints: RandomSearchConstraints | undefined,
  parameters: MovingAverageCrossParams,
): CandidateRejectionReason[] {
  const reasons: CandidateRejectionReason[] = []

  if (
    !Number.isFinite(report.summary.netProfit) ||
    !Number.isFinite(report.summary.profitFactor) ||
    !Number.isFinite(report.summary.maxDrawdown)
  ) {
    reasons.push('non_finite_analytics')
  }

  if (parameters.fastPeriod >= parameters.slowPeriod) {
    reasons.push('invalid_parameter_ordering')
  }

  if (!constraints) {
    return reasons
  }

  if (
    constraints.maxDrawdown !== undefined &&
    report.summary.maxDrawdown > constraints.maxDrawdown
  ) {
    reasons.push('max_drawdown')
  }

  if (
    constraints.minimumTrades !== undefined &&
    report.summary.totalTrades < constraints.minimumTrades
  ) {
    reasons.push('minimum_trades')
  }

  if (
    constraints.minimumProfitFactor !== undefined &&
    report.summary.profitFactor < constraints.minimumProfitFactor
  ) {
    reasons.push('minimum_profit_factor')
  }

  return reasons
}

export function tallyRejection(
  counts: Partial<Record<CandidateRejectionReason, number>>,
  reasons: CandidateRejectionReason[],
): void {
  for (const reason of reasons) {
    counts[reason] = (counts[reason] ?? 0) + 1
  }
}

/** Constraint pass check that also rejects non-finite / invalid ordering. */
export function isEligibleCandidate(
  report: BacktestReport,
  constraints: RandomSearchConstraints | undefined,
  parameters: MovingAverageCrossParams,
): { passed: boolean; reasons: CandidateRejectionReason[] } {
  const reasons = collectRejectionReasons(report, constraints, parameters)
  if (reasons.length > 0) {
    return { passed: false, reasons }
  }
  const passed = passesConstraints(report, constraints)
  return { passed, reasons: [] }
}
