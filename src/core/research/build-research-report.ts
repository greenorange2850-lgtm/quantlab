import type { BacktestReport } from '../analytics/types.js'
import type {
  ResearchAnalysisNarrative,
  ResearchRating,
  ResearchReport,
  ResearchRiskLevel,
  ResearchSession,
  RandomSearchCandidate,
} from './types.js'
import {
  estimateCandleCount,
  formatSampleSizeMessage,
} from '../../data/research-period.js'

/**
 * Package existing BacktestReport / session fields into a presentation narrative.
 * Does not introduce new analytics formulas — only labels and wording.
 */
export function buildResearchAnalysisNarrative(
  session: ResearchSession,
  best: RandomSearchCandidate | null,
): ResearchAnalysisNarrative {
  if (!best) {
    return {
      summary: `Historical research session ${session.id} evaluated ${session.candidates.length} candidate(s) under objective “${session.config.objective}”. No candidates passed the configured constraints.`,
      strengths: [],
      weaknesses: [
        'No qualifying candidates under the configured constraints.',
        session.error ? `Session message: ${session.error}` : 'Result set is empty for analysis.',
      ].filter(Boolean),
      suggestions: [
        'Relax optional constraints (drawdown, trades, profit factor) and re-run research.',
        'Widen parameter ranges or increase iterations, then validate on out-of-sample data.',
      ],
      riskLevel: 'elevated',
      rating: 'inconclusive',
    }
  }

  const { summary, statistics } = best.report
  const strengths: string[] = []
  const weaknesses: string[] = []
  const suggestions: string[] = []

  if (summary.profitFactor >= 1.5) {
    strengths.push(`Profit factor ${summary.profitFactor.toFixed(2)} (from BacktestReport).`)
  } else if (summary.profitFactor < 1) {
    weaknesses.push(`Profit factor ${summary.profitFactor.toFixed(2)} is below 1.`)
    suggestions.push('Review exits and costs — historical profit factor is under break-even.')
  } else {
    weaknesses.push(`Profit factor ${summary.profitFactor.toFixed(2)} is modest.`)
  }

  if (summary.winRate >= 0.5) {
    strengths.push(`Win rate ${(summary.winRate * 100).toFixed(1)}% (from BacktestReport).`)
  } else {
    weaknesses.push(`Win rate ${(summary.winRate * 100).toFixed(1)}% is below 50%.`)
  }

  if (summary.maxDrawdown <= 0.1) {
    strengths.push(`Max drawdown ${(summary.maxDrawdown * 100).toFixed(1)}% stayed within 10%.`)
  } else if (summary.maxDrawdown > 0.2) {
    weaknesses.push(`Max drawdown ${(summary.maxDrawdown * 100).toFixed(1)}% exceeds 20%.`)
    suggestions.push('Consider tighter risk limits — historical drawdown is elevated.')
  }

  if (summary.totalTrades >= 20) {
    strengths.push(`${summary.totalTrades} trades provide a usable historical sample.`)
  } else {
    const curve = best.report.equityCurve
    const startMs = session.config.startDate ?? curve[0]?.time
    const endMs = session.config.endDate ?? curve.at(-1)?.time
    const candleCount =
      curve.length > 2
        ? curve.length
        : startMs !== undefined && endMs !== undefined
          ? estimateCandleCount(startMs, endMs, session.config.interval)
          : session.config.limit

    weaknesses.push(
      formatSampleSizeMessage({
        totalTrades: summary.totalTrades,
        candleCount,
        interval: session.config.interval,
        startMs,
        endMs,
      }),
    )
    suggestions.push('Extend the research period or lower filters to gather more trades.')
  }

  if (summary.expectancy > 0) {
    strengths.push(`Expectancy ${summary.expectancy.toFixed(2)} is positive (from BacktestReport).`)
  } else {
    weaknesses.push(`Expectancy ${summary.expectancy.toFixed(2)} is not positive.`)
  }

  if (summary.netProfit > 0) {
    strengths.push(`Net profit ${summary.netProfit.toFixed(2)} on the historical run.`)
  } else {
    weaknesses.push(`Net profit ${summary.netProfit.toFixed(2)} on the historical run.`)
  }

  if (suggestions.length === 0) {
    suggestions.push(
      'Treat this as a historical research result — validate on unseen data before live use.',
    )
    suggestions.push('Compare top candidates in the Optimizer before applying parameters.')
  }

  return {
    summary: buildSummaryText(session, best, summary, statistics.averageTrade),
    strengths,
    weaknesses,
    suggestions,
    riskLevel: riskLevelFromDrawdown(summary.maxDrawdown),
    rating: ratingFromExistingMetrics(summary),
  }
}

function buildSummaryText(
  session: ResearchSession,
  best: RandomSearchCandidate,
  summary: BacktestReport['summary'],
  averageTrade: number,
): string {
  const params = best.parameters
  return [
    `Historical research on ${session.config.symbol} (${session.config.interval})`,
    `evaluated ${session.progress.candidatesTested}/${session.config.iterations} iterations`,
    `for objective “${session.config.objective}”.`,
    `Leading candidate parameters: fast=${params.fastPeriod}, slow=${params.slowPeriod}, rsi=${params.rsiPeriod}.`,
    `Reported net profit ${summary.netProfit.toFixed(2)}, profit factor ${summary.profitFactor.toFixed(2)},`,
    `win rate ${(summary.winRate * 100).toFixed(1)}%, max drawdown ${(summary.maxDrawdown * 100).toFixed(1)}%,`,
    `${summary.totalTrades} trades, average trade ${averageTrade.toFixed(2)}.`,
    'This is a historical research result — validation required before deployment.',
  ].join(' ')
}

function riskLevelFromDrawdown(maxDrawdown: number): ResearchRiskLevel {
  if (maxDrawdown <= 0.05) return 'low'
  if (maxDrawdown <= 0.12) return 'moderate'
  if (maxDrawdown <= 0.25) return 'elevated'
  return 'high'
}

function ratingFromExistingMetrics(summary: BacktestReport['summary']): ResearchRating {
  if (summary.totalTrades < 5) return 'inconclusive'
  if (summary.profitFactor >= 1.5 && summary.netProfit > 0 && summary.maxDrawdown <= 0.15) {
    return 'strong'
  }
  if (summary.profitFactor >= 1.2 && summary.netProfit > 0) return 'fair'
  if (summary.profitFactor >= 1 && summary.netProfit >= 0) return 'mixed'
  return 'poor'
}

/**
 * Build a research report from a completed (or terminal) Random Search session.
 * Uses candidate scores already derived from BacktestReport — no UI recomputation.
 */
export function buildResearchReport(
  session: ResearchSession,
  topN = 10,
): ResearchReport {
  const passing = session.candidates.filter((candidate) => candidate.passedConstraints)
  const ranked = [...passing].sort((a, b) => b.score - a.score)
  const best =
    (session.bestCandidateId
      ? session.candidates.find((candidate) => candidate.id === session.bestCandidateId)
      : null) ?? ranked[0] ?? null

  return {
    sessionId: session.id,
    status: session.status,
    objective: session.config.objective,
    iterationsRequested: session.config.iterations,
    iterationsCompleted: session.progress.candidatesTested,
    candidatesEvaluated: session.candidates.length,
    candidatesPassingConstraints: passing.length,
    bestCandidate: best,
    topCandidates: ranked.slice(0, topN),
    config: session.config,
    error: session.error,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    analysis: buildResearchAnalysisNarrative(session, best),
    partial: Boolean(session.partial),
  }
}
