import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'

/** Canonical fingerprint for uniqueness tracking — deterministic string. */
export function parameterFingerprint(params: MovingAverageCrossParams): string {
  return `${params.fastPeriod}:${params.slowPeriod}:${params.rsiPeriod}`
}

export class UniqueCandidateTracker {
  private readonly seen = new Set<string>()
  generated = 0
  unique = 0
  duplicatesSkipped = 0

  tryAdd(params: MovingAverageCrossParams): { fingerprint: string; isNew: boolean } {
    this.generated += 1
    const fingerprint = parameterFingerprint(params)
    if (this.seen.has(fingerprint)) {
      this.duplicatesSkipped += 1
      return { fingerprint, isNew: false }
    }
    this.seen.add(fingerprint)
    this.unique += 1
    return { fingerprint, isNew: true }
  }

  has(params: MovingAverageCrossParams): boolean {
    return this.seen.has(parameterFingerprint(params))
  }

  size(): number {
    return this.seen.size
  }
}
