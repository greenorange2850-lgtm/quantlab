import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type { RandomSearchLiveStatus, RandomSearchProgress } from './types.js'

/** Default throttle window for ordinary progress updates (100–250 ms band). */
export const DEFAULT_PROGRESS_THROTTLE_MS = 150

const IMMEDIATE_STATUSES: ReadonlySet<RandomSearchLiveStatus> = new Set([
  'INITIALIZING',
  'PAUSING',
  'PAUSED',
  'CANCELLING',
  'FINALIZING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
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
    wallElapsedMs: 0,
    pausedMs: 0,
    estimatedRemainingMs: null,
    status: 'INITIALIZING',
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
  | 'PAUSING'
  | 'PAUSED'
  | 'CANCELLING'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
> {
  const { tested, bestScore, candidatesSinceLastImprovement, justImproved } = input

  if (tested === 0) return 'EXPLORING'
  if (justImproved) return 'IMPROVING'
  if (bestScore === null) return 'EXPLORING'

  const window = improvementWindow(tested)
  const recentlyImproved =
    candidatesSinceLastImprovement !== null && candidatesSinceLastImprovement <= window

  if (recentlyImproved) return 'IMPROVING'
  return 'PLATEAUING'
}

export function estimateRemainingMs(input: {
  /** Active research time (excludes pauses). */
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

export interface TimingState {
  startedAtMs: number
  pausedTotalMs: number
  pauseStartedAtMs: number | null
}

export function createTimingState(startedAtMs: number): TimingState {
  return {
    startedAtMs,
    pausedTotalMs: 0,
    pauseStartedAtMs: null,
  }
}

export function markPauseStart(timing: TimingState, nowMs: number): void {
  if (timing.pauseStartedAtMs !== null) return
  timing.pauseStartedAtMs = nowMs
}

export function markPauseEnd(timing: TimingState, nowMs: number): void {
  if (timing.pauseStartedAtMs === null) return
  timing.pausedTotalMs += Math.max(0, nowMs - timing.pauseStartedAtMs)
  timing.pauseStartedAtMs = null
}

export function readTiming(timing: TimingState, nowMs: number): {
  wallElapsedMs: number
  pausedMs: number
  activeElapsedMs: number
} {
  const openPause =
    timing.pauseStartedAtMs !== null
      ? Math.max(0, nowMs - timing.pauseStartedAtMs)
      : 0
  const pausedMs = timing.pausedTotalMs + openPause
  const wallElapsedMs = Math.max(0, nowMs - timing.startedAtMs)
  const activeElapsedMs = Math.max(0, wallElapsedMs - pausedMs)
  return { wallElapsedMs, pausedMs, activeElapsedMs }
}

export function withElapsed(
  progress: RandomSearchProgress,
  timing: TimingState,
  nowMs: number,
): RandomSearchProgress {
  const { wallElapsedMs, pausedMs, activeElapsedMs } = readTiming(timing, nowMs)
  const estimatedRemainingMs =
    progress.status === 'PAUSED' || progress.status === 'PAUSING'
      ? progress.estimatedRemainingMs
      : estimateRemainingMs({
          elapsedMs: activeElapsedMs,
          candidatesTested: progress.candidatesTested,
          totalCandidates: progress.totalCandidates,
        })

  return {
    ...progress,
    elapsedMs: activeElapsedMs,
    wallElapsedMs,
    pausedMs,
    estimatedRemainingMs,
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
    case 'EXPLORING':
      return 'Exploring'
    case 'IMPROVING':
      return 'Improving'
    case 'PLATEAUING':
      return 'Plateauing'
    case 'PAUSING':
      return 'Pausing'
    case 'PAUSED':
      return 'Paused'
    case 'CANCELLING':
      return 'Cancelling'
    case 'FINALIZING':
      return 'Finalizing'
    case 'COMPLETED':
      return 'Completed'
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
  timing: TimingState,
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
    wallElapsedMs: 0,
    pausedMs: 0,
    estimatedRemainingMs: null,
    status: state.status,
  }
  return withElapsed(base, timing, nowMs)
}
