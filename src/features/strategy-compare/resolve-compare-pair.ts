import type { BacktestReport } from '@/core/analytics/types'
import type { PersistedBacktestDetail } from '@/backtests/detail-archive'
import { listBacktestDetailsBySavedAt } from '@/backtests/detail-archive'
import type { RandomSearchCandidate, ResearchReport } from '@/core/research'

export interface ComparePair {
  baseline: BacktestReport
  optimized: BacktestReport
  baselineId: string | null
  optimizedId: string
  optimizedCandidate: RandomSearchCandidate
}

function findCandidate(
  report: ResearchReport,
  candidateId: string | null | undefined,
  sessionCandidates: RandomSearchCandidate[] = [],
): RandomSearchCandidate | null {
  if (!candidateId) return null
  return (
    report.topCandidates.find((item) => item.id === candidateId) ??
    (report.bestCandidate?.id === candidateId ? report.bestCandidate : null) ??
    sessionCandidates.find((item) => item.id === candidateId) ??
    null
  )
}

/**
 * Resolve optimized candidate from a research report + optional selection.
 * Uses existing ResearchReport / session candidates only.
 */
export function resolveOptimizedCandidate(
  report: ResearchReport,
  selectedCandidateId: string | null,
  preferredCandidateId?: string | null,
  sessionCandidates: RandomSearchCandidate[] = [],
): RandomSearchCandidate | null {
  return (
    findCandidate(report, preferredCandidateId, sessionCandidates) ??
    findCandidate(report, selectedCandidateId, sessionCandidates) ??
    report.bestCandidate
  )
}

/**
 * Resolve a baseline BacktestReport that is not the optimized candidate.
 * Prefers an explicit baseline id, then active report, then archive (non-rs first).
 */
export function resolveBaselineReport(input: {
  optimizedBacktestId: string
  explicitBaseline?: PersistedBacktestDetail | null
  activeReport?: BacktestReport | null
  activeBacktestId?: string | null
}): { report: BacktestReport; id: string | null } | null {
  if (input.explicitBaseline && input.explicitBaseline.id !== input.optimizedBacktestId) {
    return { report: input.explicitBaseline.report, id: input.explicitBaseline.id }
  }

  if (
    input.activeReport &&
    input.activeBacktestId &&
    input.activeBacktestId !== input.optimizedBacktestId
  ) {
    return { report: input.activeReport, id: input.activeBacktestId }
  }

  const details = listBacktestDetailsBySavedAt().filter(
    (detail) => detail.id !== input.optimizedBacktestId,
  )

  if (details.length === 0) {
    if (
      input.activeReport &&
      (!input.activeBacktestId || input.activeBacktestId !== input.optimizedBacktestId)
    ) {
      return { report: input.activeReport, id: input.activeBacktestId ?? null }
    }
    return null
  }

  const nonResearch = details.find(
    (detail) => !detail.context.strategyVersion.startsWith('rs-'),
  )
  const chosen = nonResearch ?? details[0]!
  return { report: chosen.report, id: chosen.id }
}

export function buildComparePair(input: {
  researchReport: ResearchReport
  selectedCandidateId: string | null
  preferredCandidateId?: string | null
  sessionCandidates?: RandomSearchCandidate[]
  explicitBaseline?: PersistedBacktestDetail | null
  activeReport?: BacktestReport | null
  activeBacktestId?: string | null
}): ComparePair | null {
  const optimizedCandidate = resolveOptimizedCandidate(
    input.researchReport,
    input.selectedCandidateId,
    input.preferredCandidateId,
    input.sessionCandidates ?? [],
  )
  if (!optimizedCandidate) return null

  const baseline = resolveBaselineReport({
    optimizedBacktestId: optimizedCandidate.backtestId,
    explicitBaseline: input.explicitBaseline,
    activeReport: input.activeReport,
    activeBacktestId: input.activeBacktestId,
  })
  if (!baseline) return null

  return {
    baseline: baseline.report,
    optimized: optimizedCandidate.report,
    baselineId: baseline.id,
    optimizedId: optimizedCandidate.backtestId,
    optimizedCandidate,
  }
}
