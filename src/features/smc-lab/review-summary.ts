import type {
  SmcBosEvent,
  SmcDetectionKind,
  SmcDetectionResult,
  SmcSwingEvent,
} from '@/core/smc'
import type { SmcReviewRecord } from './persistence/types'

export interface SmcReviewSummaryBucket {
  kind: SmcDetectionKind | 'ALL'
  detected: number
  reviewed: number
  correct: number
  wrong: number
  unsure: number
  unreviewed: number
  /** correct / (correct + wrong); null when no decisive reviews. */
  reviewedAccuracy: number | null
}

function emptyBucket(kind: SmcReviewSummaryBucket['kind']): SmcReviewSummaryBucket {
  return {
    kind,
    detected: 0,
    reviewed: 0,
    correct: 0,
    wrong: 0,
    unsure: 0,
    unreviewed: 0,
    reviewedAccuracy: null,
  }
}

function finalize(bucket: SmcReviewSummaryBucket): SmcReviewSummaryBucket {
  const decisive = bucket.correct + bucket.wrong
  return {
    ...bucket,
    reviewedAccuracy: decisive > 0 ? bucket.correct / decisive : null,
    unreviewed: Math.max(0, bucket.detected - bucket.reviewed),
  }
}

/**
 * Build review summary. Only reviews whose configHash matches the active
 * detection config are counted as applicable.
 */
export function buildReviewSummary(input: {
  detection: SmcDetectionResult
  reviews: SmcReviewRecord[]
  activeConfigHash: string
}): {
  overall: SmcReviewSummaryBucket
  byKind: Record<SmcDetectionKind, SmcReviewSummaryBucket>
} {
  const events: Array<SmcSwingEvent | SmcBosEvent> = [
    ...input.detection.swings,
    ...input.detection.bosEvents,
  ]

  const applicable = input.reviews.filter((r) => r.configHash === input.activeConfigHash)
  const byEventId = new Map(applicable.map((r) => [r.fingerprint.eventId, r]))

  const kinds: SmcDetectionKind[] = [
    'SWING_HIGH',
    'SWING_LOW',
    'BULLISH_BOS',
    'BEARISH_BOS',
  ]
  const byKind = Object.fromEntries(kinds.map((k) => [k, emptyBucket(k)])) as Record<
    SmcDetectionKind,
    SmcReviewSummaryBucket
  >
  const overall = emptyBucket('ALL')

  for (const event of events) {
    const bucket = byKind[event.kind]
    bucket.detected += 1
    overall.detected += 1
    const review = byEventId.get(event.id)
    if (!review) continue
    bucket.reviewed += 1
    overall.reviewed += 1
    if (review.verdict === 'correct') {
      bucket.correct += 1
      overall.correct += 1
    } else if (review.verdict === 'wrong') {
      bucket.wrong += 1
      overall.wrong += 1
    } else {
      bucket.unsure += 1
      overall.unsure += 1
    }
  }

  return {
    overall: finalize(overall),
    byKind: {
      SWING_HIGH: finalize(byKind.SWING_HIGH),
      SWING_LOW: finalize(byKind.SWING_LOW),
      BULLISH_BOS: finalize(byKind.BULLISH_BOS),
      BEARISH_BOS: finalize(byKind.BEARISH_BOS),
    },
  }
}

export function formatReviewedAccuracy(bucket: SmcReviewSummaryBucket): string {
  if (bucket.reviewedAccuracy == null) return 'n/a'
  const decisive = bucket.correct + bucket.wrong
  return `${bucket.correct} / ${decisive} = ${(bucket.reviewedAccuracy * 100).toFixed(2)}%`
}
