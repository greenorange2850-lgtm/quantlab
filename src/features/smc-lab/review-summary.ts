import type {
  SmcDetectionKind,
  SmcDetectionResult,
  SmcEvent,
} from '@/core/smc'
import { listLifecycleEvents, listReviewableEvents } from './event-counts'
import type { SmcReviewRecord } from './persistence/types'

export type SmcReviewModule =
  | 'Swings'
  | 'BOS'
  | 'CHoCH'
  | 'Displacement'
  | 'FVG'
  | 'Liquidity Sweep'
  | 'Order Block'
  | 'Other'

export interface SmcReviewSummaryBucket {
  kind: SmcDetectionKind | 'ALL' | SmcReviewModule
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

export function moduleForKind(kind: SmcDetectionKind): SmcReviewModule {
  if (kind.includes('SWING') || kind.includes('EQUAL_')) return 'Swings'
  if (kind.includes('BOS')) return 'BOS'
  if (kind.includes('CHOCH')) return 'CHoCH'
  if (kind.includes('DISPLACEMENT')) return 'Displacement'
  if (kind.includes('FVG')) return 'FVG'
  if (kind.includes('LIQUIDITY_SWEEP')) return 'Liquidity Sweep'
  if (kind.includes('ORDER_BLOCK')) return 'Order Block'
  return 'Other'
}

/** All stored events (including lifecycle and base+classified). Prefer listReviewableEvents for reviews. */
export function flattenDetectionEvents(detection: SmcDetectionResult): SmcEvent[] {
  return [
    ...detection.swings,
    ...detection.classifiedSwings,
    ...detection.bosEvents,
    ...detection.chochEvents,
    ...detection.displacementEvents,
    ...detection.fvgEvents,
    ...detection.equalLevelEvents,
    ...detection.liquiditySweepEvents,
    ...detection.orderBlockEvents,
  ]
}

/**
 * Build review summary from unique reviewable events only.
 * Lifecycle updates are excluded from Detected / reviewed agreement.
 */
export function buildReviewSummary(input: {
  detection: SmcDetectionResult
  reviews: SmcReviewRecord[]
  activeConfigHash: string
}): {
  overall: SmcReviewSummaryBucket
  byKind: Partial<Record<SmcDetectionKind, SmcReviewSummaryBucket>>
  byModule: Record<SmcReviewModule, SmcReviewSummaryBucket>
  historicalReviews: SmcReviewRecord[]
  lifecycleUpdateCount: number
  uniqueReviewableCount: number
} {
  const events = listReviewableEvents(input.detection)
  const lifecycleUpdateCount = listLifecycleEvents(input.detection).length

  const applicable = input.reviews.filter((r) => r.configHash === input.activeConfigHash)
  const historicalReviews = input.reviews.filter((r) => r.configHash !== input.activeConfigHash)
  const byEventId = new Map(applicable.map((r) => [r.fingerprint.eventId, r]))

  const byKind: Partial<Record<SmcDetectionKind, SmcReviewSummaryBucket>> = {}
  const modules: SmcReviewModule[] = [
    'Swings',
    'BOS',
    'CHoCH',
    'Displacement',
    'FVG',
    'Liquidity Sweep',
    'Order Block',
    'Other',
  ]
  const byModule = Object.fromEntries(modules.map((m) => [m, emptyBucket(m)])) as Record<
    SmcReviewModule,
    SmcReviewSummaryBucket
  >
  const overall = emptyBucket('ALL')

  for (const event of events) {
    const kindBucket = byKind[event.kind] ?? emptyBucket(event.kind)
    kindBucket.detected += 1
    byKind[event.kind] = kindBucket

    const module = moduleForKind(event.kind)
    const moduleBucket = byModule[module]
    moduleBucket.detected += 1
    overall.detected += 1

    const review = byEventId.get(event.id)
    if (!review) continue
    kindBucket.reviewed += 1
    moduleBucket.reviewed += 1
    overall.reviewed += 1
    if (review.verdict === 'correct') {
      kindBucket.correct += 1
      moduleBucket.correct += 1
      overall.correct += 1
    } else if (review.verdict === 'wrong') {
      kindBucket.wrong += 1
      moduleBucket.wrong += 1
      overall.wrong += 1
    } else {
      kindBucket.unsure += 1
      moduleBucket.unsure += 1
      overall.unsure += 1
    }
  }

  for (const key of Object.keys(byKind) as SmcDetectionKind[]) {
    byKind[key] = finalize(byKind[key]!)
  }
  for (const key of modules) {
    byModule[key] = finalize(byModule[key])
  }

  return {
    overall: finalize(overall),
    byKind,
    byModule,
    historicalReviews,
    lifecycleUpdateCount,
    uniqueReviewableCount: events.length,
  }
}

export function formatReviewedAccuracy(bucket: SmcReviewSummaryBucket): string {
  if (bucket.reviewedAccuracy == null) return 'n/a'
  const decisive = bucket.correct + bucket.wrong
  return `${bucket.correct} / ${decisive} = ${(bucket.reviewedAccuracy * 100).toFixed(2)}%`
}
