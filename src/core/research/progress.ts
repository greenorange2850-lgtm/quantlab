import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type { RandomSearchLiveStatus, RandomSearchProgress } from './types.js'

/** Default throttle window for ordinary progress updates (100–250 ms band). */
export const DEFAULT_PROGRESS_THROTTLE_MS = 150

const IMMEDIATE_STATUSES: ReadonlySet<RandomSearchLiveStatus> = new Set([
  'INITIALIZING',
  'BASELINE',
  'FINALIZING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'PAUSING',
  'PAUSED',
  'CANCELLING',
  'CONVERGED',
])

export function createEmptyProgress(totalCandidates: number): RandomSearchProgress {
  return {
    totalCandidates,
    candidatesTested: 0,
    candidatesAccepted: 0,
    candidatesRejected: 0,
    currentCandidateScore: null,
    bestScore: null,
    bestTradeCount: null,
    bestCandidateParameters: null,
    improvementsCount: 0,
    candidatesSinceLastImprovement: null,
    elapsedMs: 0,
    estimatedRemainingMs: null,
    status: 'INITIALIZING',
    stage: null,
    uniqueCandidates: 0,
    duplicatesSkipped: 0,
    generatedCandidates: 0,
    baselineScore: null,
    rawBestScore: null,
    recommendedScore: null,
    pausedMs: 0,
    plateauDetected: false,
    lastImprovementEvent: null,
    newBestEvent: null,
  }
}

export function isImmediateProgressStatus(status: RandomSearchLiveStatus): boolean {
  return IMMEDIATE_STATUSES.has(status)
}

/** Plateau window mirrors research-intelligence improvingWindow. */
export function improvementWindow(tested: number): number {
  return Math.max(5, Math.ceil(tested * 0.15))
}

export function deriveLiveSearchStatus(input: {
  tested: number
  total: number
  bestScore: number | null
  candidatesSinceLastImprovement: number | null
  justImproved: boolean
}): Exclude<
  RandomSearchLiveStatus,
  | 'INITIALIZING'
  | 'BASELINE'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAUSING'
  | 'PAUSED'
  | 'CANCELLING'
  | 'REFINING'
  | 'STABILITY_CHECK'
  | 'CONVERGED'
> {
  const { tested, total, bestScore, candidatesSinceLastImprovement, justImproved } = input

  if (tested === 0) return 'EXPLORING'
  if (justImproved) return 'IMPROVING'
  if (bestScore === null) {
    return total > 0 && tested / total >= 0.5 ? 'EXPLORING' : 'EXPLORING'
  }

  const window = improvementWindow(tested)
  const recentlyImproved =
    candidatesSinceLastImprovement !== null && candidatesSinceLastImprovement <= window

  if (recentlyImproved) return 'IMPROVING'
  return 'PLATEAUING'
}

export function estimateRemainingMs(input: {
  elapsedMs: number
  candidatesTested: number
  totalCandidates: number
}): number | null {
  const { elapsedMs, candidatesTested, totalCandidates } = input
  if (candidatesTested <= 0 || elapsedMs <= 0) return null
  const remaining = totalCandidates - candidatesTested
  if (remaining <= 0) return 0
  const avg = elapsedMs / candidatesTested
  return Math.round(avg * remaining)
}

export function withElapsed(
  progress: RandomSearchProgress,
  startedAtMs: number,
  nowMs: number,
): RandomSearchProgress {
  const elapsedMs = Math.max(0, nowMs - startedAtMs)
  return {
    ...progress,
    elapsedMs,
    estimatedRemainingMs: estimateRemainingMs({
      elapsedMs,
      candidatesTested: progress.candidatesTested,
      totalCandidates: progress.totalCandidates,
    }),
  }
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

export function formatLiveStatusLabel(status: RandomSearchLiveStatus): string {
  switch (status) {
    case 'INITIALIZING':
      return 'Initializing'
    case 'BASELINE':
      return 'Baseline'
    case 'EXPLORING':
      return 'Exploring'
    case 'REFINING':
      return 'Refining'
    case 'STABILITY_CHECK':
      return 'Stability Check'
    case 'IMPROVING':
      return 'Improving'
    case 'PLATEAUING':
      return 'Plateauing'
    case 'CONVERGED':
      return 'Converged'
    case 'FINALIZING':
      return 'Finalizing'
    case 'COMPLETED':
      return 'Completed'
    case 'PAUSING':
      return 'Pausing'
    case 'PAUSED':
      return 'Paused'
    case 'CANCELLING':
      return 'Cancelling'
    case 'FAILED':
      return 'Failed'
    case 'CANCELLED':
      return 'Cancelled'
  }
}

export function isBestImprovement(
  previous: RandomSearchProgress | null,
  next: RandomSearchProgress,
): boolean {
  if (next.improvementsCount > (previous?.improvementsCount ?? 0)) return true
  if (
    next.bestScore !== null &&
    previous?.bestScore !== next.bestScore &&
    (previous?.bestScore === null ||
      previous?.bestScore === undefined ||
      next.bestScore > previous.bestScore)
  ) {
    return true
  }
  return false
}

export type ProgressBuildState = {
  totalCandidates: number
  candidatesTested: number
  candidatesAccepted: number
  candidatesRejected: number
  currentCandidateScore: number | null
  bestScore: number | null
  bestTradeCount: number | null
  bestCandidateParameters: MovingAverageCrossParams | null
  improvementsCount: number
  candidatesSinceLastImprovement: number | null
  justImproved: boolean
  status: RandomSearchLiveStatus
}

export function buildProgressPayload(
  state: ProgressBuildState,
  startedAtMs: number,
  nowMs: number,
): RandomSearchProgress {
  const base: RandomSearchProgress = {
    totalCandidates: state.totalCandidates,
    candidatesTested: state.candidatesTested,
    candidatesAccepted: state.candidatesAccepted,
    candidatesRejected: state.candidatesRejected,
    currentCandidateScore: state.currentCandidateScore,
    bestScore: state.bestScore,
    bestTradeCount: state.bestTradeCount,
    bestCandidateParameters: state.bestCandidateParameters
      ? { ...state.bestCandidateParameters }
      : null,
    improvementsCount: state.improvementsCount,
    candidatesSinceLastImprovement: state.candidatesSinceLastImprovement,
    elapsedMs: 0,
    estimatedRemainingMs: null,
    status: state.status,
  }
  return withElapsed(base, startedAtMs, nowMs)
}
