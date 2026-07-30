/**
 * Presentation-only Research Intelligence helpers.
 * Derives status, health labels, and recommendations from existing
 * research/session/report fields — no new scoring or analytics formulas.
 */

import type {
  RandomSearchCandidate,
  RandomSearchLiveStatus,
  RandomSearchProgress,
  ResearchRating,
  ResearchReport,
  ResearchSession,
  ResearchSessionStatus,
} from '@/core/research'
import type { BacktestReport } from '@/core/analytics/types'
import {
  drawdownQuality,
  profitFactorQuality,
  type MetricQuality,
} from '@/lib/metric-semantics'

export type ResearchPhaseStatus =
  | 'exploring'
  | 'improving'
  | 'plateauing'
  | 'converged'

export type ResearchHealthLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor'

export interface ResearchProgressSnapshot {
  candidatesTested: number
  accepted: number | null
  rejected: number | null
  currentBestScore: number | null
  /** Trade count of the current best candidate (not summed). */
  bestTradeCount: number | null
  /** Candidates evaluated since the last best-score improvement; null if unknown/no best. */
  lastImprovementAgo: number | null
  improvementsCount: number | null
  status: ResearchPhaseStatus
  liveStatus: RandomSearchLiveStatus | null
  total: number
  elapsedMs: number | null
  estimatedRemainingMs: number | null
  sessionStatus: ResearchSessionStatus | 'idle'
}

export interface ResearchHealthSnapshot {
  rating: ResearchHealthLabel
  reasons: string[]
  /** Underlying packaged research rating when available. */
  sourceRating: ResearchRating | null
}

export interface ResearchRecommendation {
  title: string
  detail: string
}

export interface OptimizerTransparencySnapshot {
  candidatesGenerated: number
  passedFilters: number | null
  rejected: number | null
  currentBest: number | null
}

export interface ResearchIntelligenceInput {
  progress: RandomSearchProgress | null
  report: ResearchReport | null
  session: ResearchSession | null
  /** UI store status when progress/session status is idle. */
  uiRunning?: boolean
}

/** How many candidates since last best among passing candidates (append order). */
export function deriveLastImprovementAgo(
  candidates: RandomSearchCandidate[],
): number | null {
  let best = Number.NEGATIVE_INFINITY
  let lastImprovementIndex: number | null = null

  candidates.forEach((candidate, index) => {
    if (candidate.passedConstraints && candidate.score > best) {
      best = candidate.score
      lastImprovementIndex = index
    }
  })

  if (lastImprovementIndex === null) return null
  return candidates.length - 1 - lastImprovementIndex
}

function improvingWindow(tested: number): number {
  return Math.max(5, Math.ceil(tested * 0.15))
}

function isTerminal(status: ResearchSessionStatus | 'idle'): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed'
}

export function liveStatusToSessionStatus(
  status: RandomSearchLiveStatus | null | undefined,
): ResearchSessionStatus | null {
  if (!status) return null
  switch (status) {
    case 'COMPLETED':
      return 'completed'
    case 'FAILED':
      return 'failed'
    case 'CANCELLED':
    case 'CANCELLING':
      return 'cancelled'
    case 'INITIALIZING':
    case 'EXPLORING':
    case 'IMPROVING':
    case 'PLATEAUING':
    case 'PAUSING':
    case 'PAUSED':
    case 'FINALIZING':
      return 'running'
  }
}

export function liveStatusToPhaseStatus(
  status: RandomSearchLiveStatus | null | undefined,
): ResearchPhaseStatus | null {
  if (!status) return null
  switch (status) {
    case 'INITIALIZING':
    case 'EXPLORING':
      return 'exploring'
    case 'IMPROVING':
      return 'improving'
    case 'PLATEAUING':
    case 'PAUSING':
    case 'PAUSED':
      return 'plateauing'
    case 'FINALIZING':
    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELLED':
    case 'CANCELLING':
      return 'converged'
  }
}

export function deriveResearchPhaseStatus(input: {
  tested: number
  total: number
  accepted: number | null
  bestScore: number | null
  lastImprovementAgo: number | null
  sessionStatus: ResearchSessionStatus | 'idle'
  uiRunning?: boolean
  liveStatus?: RandomSearchLiveStatus | null
}): ResearchPhaseStatus {
  const fromLive = liveStatusToPhaseStatus(input.liveStatus)
  if (fromLive) return fromLive

  const {
    tested,
    total,
    accepted,
    bestScore,
    lastImprovementAgo,
    sessionStatus,
    uiRunning,
  } = input

  const running = sessionStatus === 'running' || Boolean(uiRunning)
  const terminal = isTerminal(sessionStatus)
  const fraction = total > 0 ? tested / total : 0
  const hasBest = bestScore !== null && (accepted === null || accepted > 0)

  if (tested === 0) return 'exploring'

  if (!hasBest) {
    if (terminal) return 'converged'
    if (fraction < 0.5) return 'exploring'
    return running ? 'exploring' : 'converged'
  }

  const window = improvingWindow(tested)
  const recentlyImproved =
    lastImprovementAgo !== null && lastImprovementAgo <= window

  if (terminal) {
    if (recentlyImproved && fraction < 1) return 'improving'
    return 'converged'
  }

  if (fraction < 0.25 && lastImprovementAgo === null) return 'exploring'
  if (recentlyImproved) return 'improving'
  if (running) return 'plateauing'
  return 'converged'
}

export function buildResearchProgressSnapshot(
  input: ResearchIntelligenceInput,
): ResearchProgressSnapshot | null {
  const { progress, report, session, uiRunning } = input
  if (!progress && !report && !session) return null

  const candidates = session?.candidates
  const tested =
    progress?.candidatesTested ??
    report?.candidatesEvaluated ??
    candidates?.length ??
    0
  const total =
    progress?.totalCandidates ??
    report?.iterationsRequested ??
    session?.config.iterations ??
    tested

  const accepted =
    progress?.candidatesAccepted ??
    report?.candidatesPassingConstraints ??
    (candidates
      ? candidates.filter((candidate) => candidate.passedConstraints).length
      : null)

  const rejected =
    progress?.candidatesRejected ??
    (accepted === null ? null : Math.max(0, tested - accepted))

  const currentBestScore =
    progress?.bestScore ??
    session?.progress.bestScore ??
    report?.bestCandidate?.score ??
    null

  const bestTradeCount =
    progress?.bestTradeCount ??
    report?.bestCandidate?.report.summary.totalTrades ??
    (session?.bestCandidateId
      ? session.candidates.find((c) => c.id === session.bestCandidateId)?.report.summary
          .totalTrades ?? null
      : null)

  const lastImprovementAgo =
    progress?.candidatesSinceLastImprovement ??
    (candidates ? deriveLastImprovementAgo(candidates) : null)

  const improvementsCount = progress?.improvementsCount ?? null

  const sessionStatus: ResearchSessionStatus | 'idle' =
    liveStatusToSessionStatus(progress?.status) ??
    session?.status ??
    report?.status ??
    'idle'

  const status = deriveResearchPhaseStatus({
    tested,
    total,
    accepted,
    bestScore: currentBestScore,
    lastImprovementAgo,
    sessionStatus,
    uiRunning,
    liveStatus: progress?.status ?? null,
  })

  return {
    candidatesTested: tested,
    accepted,
    rejected,
    currentBestScore,
    bestTradeCount,
    lastImprovementAgo,
    improvementsCount,
    status,
    liveStatus: progress?.status ?? null,
    total,
    elapsedMs: progress?.elapsedMs ?? null,
    estimatedRemainingMs: progress?.estimatedRemainingMs ?? null,
    sessionStatus,
  }
}

/** Map packaged ResearchRating → Phase 1 health vocabulary (no new score). */
export function mapResearchRatingToHealth(
  rating: ResearchRating | null | undefined,
): ResearchHealthLabel {
  switch (rating) {
    case 'strong':
      return 'Excellent'
    case 'fair':
      return 'Good'
    case 'mixed':
      return 'Fair'
    case 'poor':
      return 'Poor'
    case 'inconclusive':
      return 'Fair'
    default:
      return 'Fair'
  }
}

function winRateReason(summary: BacktestReport['summary']): string {
  if (summary.totalTrades < 20) return 'Win Rate unstable'
  if (summary.winRate >= 0.5) return 'Win Rate acceptable'
  return 'Win Rate below 50%'
}

function profitFactorReason(quality: MetricQuality, value: number): string {
  if (quality === 'excellent') return 'Profit Factor healthy'
  if (quality === 'average') return 'Profit Factor below target'
  if (value < 1) return 'Profit Factor below break-even'
  return 'Profit Factor below target'
}

function drawdownReason(quality: MetricQuality): string {
  if (quality === 'excellent') return 'Drawdown acceptable'
  if (quality === 'average') return 'Drawdown moderate'
  return 'Drawdown elevated'
}

/**
 * Reason bullets from existing BacktestReport summary thresholds
 * (aligned with metric-semantics / narrative packaging — not a new score).
 */
export function buildResearchHealthReasons(
  summary: BacktestReport['summary'] | null | undefined,
): string[] {
  if (!summary) {
    return [
      'No qualifying candidates under configured constraints',
      'Relax filters or widen parameter ranges',
    ]
  }

  const reasons: string[] = [
    profitFactorReason(profitFactorQuality(summary.profitFactor), summary.profitFactor),
    drawdownReason(drawdownQuality(summary.maxDrawdown)),
    winRateReason(summary),
  ]

  if (summary.totalTrades < 10) {
    reasons.push('Trade sample is limited')
  } else if (summary.expectancy > 0) {
    reasons.push('Expectancy positive on historical run')
  } else {
    reasons.push('Expectancy not positive')
  }

  return reasons
}

export function buildResearchHealthSnapshot(
  report: ResearchReport | null,
): ResearchHealthSnapshot | null {
  if (!report) return null

  const summary = report.bestCandidate?.report.summary
  const sourceRating = report.analysis.rating

  return {
    rating: mapResearchRatingToHealth(sourceRating),
    reasons: buildResearchHealthReasons(summary),
    sourceRating,
  }
}

export function buildResearchRecommendation(
  progress: ResearchProgressSnapshot | null,
  health: ResearchHealthSnapshot | null,
): ResearchRecommendation | null {
  if (!progress && !health) return null

  const status = progress?.status
  const accepted = progress?.accepted
  const noPass = accepted === 0 || (health?.sourceRating === 'inconclusive' && accepted === 0)

  if (noPass && progress && isTerminal(progress.sessionStatus)) {
    return {
      title: 'Adjust Search',
      detail:
        'No candidates passed filters. Relax constraints or expand parameter ranges, then re-run.',
    }
  }

  switch (status) {
    case 'improving':
      return {
        title: 'Continue Search',
        detail: 'Search is still improving.',
      }
    case 'exploring':
      return {
        title: 'Continue Search',
        detail: 'Still exploring the parameter space.',
      }
    case 'plateauing':
      return {
        title: 'Search appears to have plateaued.',
        detail: 'Consider expanding parameter ranges or starting validation.',
      }
    case 'converged':
      return {
        title: 'Search appears complete.',
        detail: 'Consider expanding parameter ranges or starting validation.',
      }
    default:
      if (health?.rating === 'Excellent' || health?.rating === 'Good') {
        return {
          title: 'Review Best Candidate',
          detail: 'Historical metrics look constructive — validate before applying.',
        }
      }
      return {
        title: 'Review Results',
        detail: 'Inspect health reasons and top candidates before continuing.',
      }
  }
}

export function buildOptimizerTransparency(
  input: ResearchIntelligenceInput,
): OptimizerTransparencySnapshot | null {
  const progress = buildResearchProgressSnapshot(input)
  if (!progress) return null

  return {
    candidatesGenerated: progress.candidatesTested,
    passedFilters: progress.accepted,
    rejected: progress.rejected,
    currentBest: progress.currentBestScore,
  }
}

export function formatPhaseStatusLabel(status: ResearchPhaseStatus): string {
  switch (status) {
    case 'exploring':
      return 'Exploring'
    case 'improving':
      return 'Improving'
    case 'plateauing':
      return 'Plateauing'
    case 'converged':
      return 'Converged'
  }
}

export function formatScoreOrDash(score: number | null | undefined, digits = 3): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return '—'
  return score.toFixed(digits)
}

export function formatCountOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}
