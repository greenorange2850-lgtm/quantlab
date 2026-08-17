import type { ResearchSetupReview, ResearchReviewVerdict } from './types.js'

const STORAGE_KEY = 'quantlab.candle-research-reviews.v1'

let memoryReviews: ResearchSetupReview[] = []

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function readStorage(): ResearchSetupReview[] {
  if (!canUseStorage()) return [...memoryReviews]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is ResearchSetupReview => {
      return (
        !!value &&
        typeof value === 'object' &&
        typeof (value as ResearchSetupReview).setupId === 'string' &&
        typeof (value as ResearchSetupReview).backtestId === 'string' &&
        typeof (value as ResearchSetupReview).hypothesis === 'string' &&
        typeof (value as ResearchSetupReview).verdict === 'string' &&
        Number.isFinite((value as ResearchSetupReview).reviewedAt)
      )
    })
  } catch {
    return []
  }
}

function writeStorage(reviews: ResearchSetupReview[]): void {
  memoryReviews = [...reviews]
  if (!canUseStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
  } catch {
    // ignore quota/private mode failures
  }
}

export function listCandleResearchReviews(backtestId: string): ResearchSetupReview[] {
  return readStorage()
    .filter((review) => review.backtestId === backtestId)
    .sort((a, b) => b.reviewedAt - a.reviewedAt)
}

export function getCandleResearchReview(
  backtestId: string,
  setupId: string,
): ResearchSetupReview | null {
  return (
    readStorage().find((review) => review.backtestId === backtestId && review.setupId === setupId) ?? null
  )
}

export function saveCandleResearchReview(input: {
  backtestId: string
  setupId: string
  hypothesis: 'DIRECT_CONSUMPTION'
  verdict: ResearchReviewVerdict
}): ResearchSetupReview {
  const next: ResearchSetupReview = {
    backtestId: input.backtestId,
    setupId: input.setupId,
    hypothesis: input.hypothesis,
    verdict: input.verdict,
    reviewedAt: Date.now(),
  }
  const withoutCurrent = readStorage().filter(
    (review) => !(review.backtestId === next.backtestId && review.setupId === next.setupId),
  )
  const updated = [next, ...withoutCurrent]
  writeStorage(updated)
  return next
}

export function clearCandleResearchReview(backtestId: string, setupId: string): void {
  const next = readStorage().filter(
    (review) => !(review.backtestId === backtestId && review.setupId === setupId),
  )
  writeStorage(next)
}

export function clearCandleResearchReviewStorageForTests(): void {
  memoryReviews = []
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
