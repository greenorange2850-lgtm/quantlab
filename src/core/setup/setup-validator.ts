/**
 * Manual setup validation — Correct / Wrong / Unsure + aggregate metrics.
 */

import type {
  SetupReviewRecord,
  SetupReviewVerdict,
  SetupStatus,
  SetupType,
  SetupValidationMetrics,
  TradingSetup,
} from './setup-types'

export function createSetupReview(input: {
  setup: TradingSetup
  verdict: SetupReviewVerdict
  note?: string
  reviewedAt?: number
}): SetupReviewRecord {
  return {
    setupId: input.setup.id,
    setupType: input.setup.setupType,
    direction: input.setup.direction,
    statusAtReview: input.setup.status,
    verdict: input.verdict,
    note: input.note ?? '',
    reviewedAt: input.reviewedAt ?? Date.now(),
  }
}

/**
 * Precision / recall / agreement over reviewed samples only.
 * - False Ready: reviewed Wrong while status was READY
 * - False Reject: reviewed Correct while status was INVALIDATED/EXPIRED (missed good setup)
 */
export function computeSetupValidationMetrics(
  reviews: readonly SetupReviewRecord[],
): SetupValidationMetrics {
  const reviewedCount = reviews.length
  const correctCount = reviews.filter((r) => r.verdict === 'correct').length
  const wrongCount = reviews.filter((r) => r.verdict === 'wrong').length
  const unsureCount = reviews.filter((r) => r.verdict === 'unsure').length
  const decided = correctCount + wrongCount

  const falseReady = reviews.filter(
    (r) => r.verdict === 'wrong' && r.statusAtReview === 'READY',
  ).length
  const falseReject = reviews.filter(
    (r) =>
      r.verdict === 'correct' &&
      (r.statusAtReview === 'INVALIDATED' || r.statusAtReview === 'EXPIRED'),
  ).length

  const agreement = decided > 0 ? correctCount / decided : null
  // Precision: among READY reviews that were decided, share correct.
  const readyDecided = reviews.filter(
    (r) => r.statusAtReview === 'READY' && r.verdict !== 'unsure',
  )
  const readyCorrect = readyDecided.filter((r) => r.verdict === 'correct').length
  const precision = readyDecided.length > 0 ? readyCorrect / readyDecided.length : null

  // Recall proxy: correct READY / (correct READY + falseReject)
  const correctReady = reviews.filter(
    (r) => r.verdict === 'correct' && r.statusAtReview === 'READY',
  ).length
  const recallDenom = correctReady + falseReject
  const recall = recallDenom > 0 ? correctReady / recallDenom : null

  return {
    reviewedCount,
    correctCount,
    wrongCount,
    unsureCount,
    precision,
    recall,
    agreement,
    falseReady,
    falseReject,
  }
}

export function upsertSetupReview(
  reviews: readonly SetupReviewRecord[],
  next: SetupReviewRecord,
): SetupReviewRecord[] {
  const without = reviews.filter((r) => r.setupId !== next.setupId)
  return [...without, next]
}

export function reviewsBySetupType(
  reviews: readonly SetupReviewRecord[],
): Record<SetupType, SetupReviewRecord[]> {
  const out = {} as Record<SetupType, SetupReviewRecord[]>
  for (const r of reviews) {
    if (!out[r.setupType]) out[r.setupType] = []
    out[r.setupType].push(r)
  }
  return out
}

export function isActionableStatus(status: SetupStatus): boolean {
  return status === 'READY' || status === 'WAITING_RETEST' || status === 'WATCHING'
}
