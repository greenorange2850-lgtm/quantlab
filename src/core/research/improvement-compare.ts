import type { BacktestReport } from '../analytics/types.js'
import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type {
  MetricChange,
  OptimizationBaseline,
  OptimizationVerdict,
  ParameterChange,
  RandomSearchCandidate,
  ResearchRating,
  StabilityResult,
} from './types.js'

export function ratingFromExistingMetrics(summary: BacktestReport['summary']): ResearchRating {
  if (summary.totalTrades < 5) return 'inconclusive'
  if (summary.profitFactor >= 1.5 && summary.netProfit > 0 && summary.maxDrawdown <= 0.15) {
    return 'strong'
  }
  if (summary.profitFactor >= 1.2 && summary.netProfit > 0) return 'fair'
  if (summary.profitFactor >= 1 && summary.netProfit >= 0) return 'mixed'
  return 'poor'
}

export function buildMetricChanges(
  before: BacktestReport['summary'],
  after: BacktestReport['summary'],
  beforeScore: number,
  afterScore: number,
): MetricChange[] {
  const changes: MetricChange[] = []

  const push = (
    key: string,
    label: string,
    a: number,
    b: number,
    direction: MetricChange['direction'],
    format: (v: number) => string,
  ) => {
    let improved: boolean | null = null
    if (direction === 'higher_better') improved = b > a
    else if (direction === 'lower_better') improved = b < a
    else improved = null

    const text =
      direction === 'context'
        ? `${label} changed from ${format(a)} to ${format(b)}.`
        : improved
          ? `${label} improved from ${format(a)} to ${format(b)}.`
          : b === a
            ? `${label} unchanged at ${format(b)}.`
            : `${label} declined from ${format(a)} to ${format(b)}.`

    changes.push({ key, label, before: a, after: b, direction, improved, text })
  }

  push('score', 'Research Score', beforeScore, afterScore, 'higher_better', (v) => v.toFixed(2))
  push('netProfit', 'Net Profit', before.netProfit, after.netProfit, 'higher_better', (v) =>
    `$${v.toFixed(2)}`,
  )
  const beforeRoi =
    before.finalBalance - before.netProfit !== 0
      ? before.netProfit / (before.finalBalance - before.netProfit)
      : 0
  const afterRoi =
    after.finalBalance - after.netProfit !== 0
      ? after.netProfit / (after.finalBalance - after.netProfit)
      : 0
  // ROI derived from existing finalBalance/netProfit only (presentation).
  push('roi', 'ROI', beforeRoi, afterRoi, 'higher_better', (v) => `${(v * 100).toFixed(2)}%`)
  push(
    'profitFactor',
    'Profit Factor',
    before.profitFactor,
    after.profitFactor,
    'higher_better',
    (v) => v.toFixed(2),
  )
  push(
    'maxDrawdown',
    'Max Drawdown',
    before.maxDrawdown,
    after.maxDrawdown,
    'lower_better',
    (v) => `${(v * 100).toFixed(2)}%`,
  )
  push('winRate', 'Win Rate', before.winRate, after.winRate, 'higher_better', (v) =>
    `${(v * 100).toFixed(2)}%`,
  )
  push(
    'tradeCount',
    'Trade Count',
    before.totalTrades,
    after.totalTrades,
    'context',
    (v) => `${Math.round(v)}`,
  )
  push(
    'expectancy',
    'Expectancy',
    before.expectancy,
    after.expectancy,
    'higher_better',
    (v) => v.toFixed(2),
  )

  return changes
}

export function buildParameterChanges(
  before: MovingAverageCrossParams,
  after: MovingAverageCrossParams,
): ParameterChange[] {
  return [
    { name: 'fastPeriod', label: 'EMA Fast', before: before.fastPeriod, after: after.fastPeriod },
    { name: 'slowPeriod', label: 'EMA Slow', before: before.slowPeriod, after: after.slowPeriod },
    { name: 'rsiPeriod', label: 'RSI Period', before: before.rsiPeriod, after: after.rsiPeriod },
  ]
}

export function deriveVerdict(input: {
  baseline: OptimizationBaseline | null
  recommended: RandomSearchCandidate | null
  eligibleCount: number
  stability: StabilityResult | null
  stabilityIncomplete: boolean
}): { verdict: OptimizationVerdict; detail: string } {
  const { baseline, recommended, eligibleCount, stability, stabilityIncomplete } = input

  if (eligibleCount === 0 || !recommended) {
    return {
      verdict: 'Constraints Not Met',
      detail:
        'No candidates passed the configured constraints. Extend the research period, widen parameter ranges, or relax a selected constraint.',
    }
  }

  if (!baseline) {
    return {
      verdict: 'Insufficient Evidence',
      detail: 'Baseline was unavailable, so improvement cannot be judged honestly.',
    }
  }

  if (recommended.report.summary.totalTrades < 5) {
    return {
      verdict: 'Insufficient Evidence',
      detail:
        'The recommended candidate has too few trades for a reliable historical conclusion. Extend the research period before validation.',
    }
  }

  const scoreDelta = recommended.score - baseline.score
  const meaningful =
    Math.abs(baseline.score) > 1e-9
      ? scoreDelta / Math.abs(baseline.score) >= 0.05 || scoreDelta > 0.05
      : scoreDelta > 0.05

  if (stabilityIncomplete) {
    return {
      verdict: meaningful ? 'Insufficient Evidence' : 'No Meaningful Improvement',
      detail: meaningful
        ? 'Historical score improved, but stability analysis was incomplete. Treat the result as provisional.'
        : 'Search finished without a clear improvement and stability analysis was incomplete.',
    }
  }

  if (!meaningful) {
    return {
      verdict: 'No Meaningful Improvement',
      detail:
        'The recommended candidate did not meaningfully outperform the Strategy Lab baseline on the shared historical dataset.',
    }
  }

  if (stability?.overall === 'LOW') {
    return {
      verdict: 'Improved but Unstable',
      detail:
        'Historical performance improved, but parameter stability is low. Continue refinement or expand the research period before validation.',
    }
  }

  if (stability?.overall === 'INSUFFICIENT_EVIDENCE') {
    return {
      verdict: 'Insufficient Evidence',
      detail:
        'Score improved versus baseline, but there were not enough nearby samples to confirm stability.',
    }
  }

  return {
    verdict: 'Meaningfully Improved',
    detail:
      'Historical performance improved versus the Strategy Lab baseline with acceptable parameter-region evidence. Validation on unseen data is still required.',
  }
}
