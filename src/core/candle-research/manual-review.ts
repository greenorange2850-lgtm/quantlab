import type { CandleResearchManualReview, ManualReviewVerdict } from './types'

const STORAGE_KEY = 'quantlab.candle-research.reviews.v1'

let memoryReviews: Record<string, CandleResearchManualReview> = {}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function sanitize(value: unknown): Record<string, CandleResearchManualReview> {
  if (!value || typeof value !== 'object') return {}
  const entries = Object.entries(value as Record<string, unknown>)
  const result: Record<string, CandleResearchManualReview> = {}
  for (const [key, raw] of entries) {
    if (!raw || typeof raw !== 'object') continue
    const candidate = raw as Partial<CandleResearchManualReview>
    if (
      typeof candidate.setupId !== 'string' ||
      !candidate.setupId ||
      (candidate.verdict !== 'correct' && candidate.verdict !== 'wrong' && candidate.verdict !== 'unclear') ||
      typeof candidate.note !== 'string' ||
      typeof candidate.updatedAt !== 'number'
    ) {
      continue
    }
    result[key] = {
      setupId: candidate.setupId,
      verdict: candidate.verdict,
      note: candidate.note,
      updatedAt: candidate.updatedAt,
    }
  }
  return result
}

export function loadCandleResearchReviews(): Record<string, CandleResearchManualReview> {
  if (!canUseStorage()) return { ...memoryReviews }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...memoryReviews }
    const parsed = sanitize(JSON.parse(raw))
    memoryReviews = parsed
    return { ...parsed }
  } catch {
    return { ...memoryReviews }
  }
}

export function saveCandleResearchReview(input: {
  setupId: string
  verdict: ManualReviewVerdict
  note?: string
}): CandleResearchManualReview {
  const all = loadCandleResearchReviews()
  const record: CandleResearchManualReview = {
    setupId: input.setupId,
    verdict: input.verdict,
    note: input.note ?? '',
    updatedAt: Date.now(),
  }
  all[input.setupId] = record
  memoryReviews = all
  if (canUseStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch {
      // ignore quota issues
    }
  }
  return record
}

export function clearCandleResearchReviewsForTests(): void {
  memoryReviews = {}
  if (!canUseStorage()) return
  localStorage.removeItem(STORAGE_KEY)
}
