import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProgress } from '../progress.js'
import { createThrottledProgressHandler } from '../progress-throttle.js'
import type { RandomSearchProgress } from '../types.js'

function progress(
  overrides: Partial<RandomSearchProgress> &
    Pick<RandomSearchProgress, 'candidatesTested' | 'status'>,
): RandomSearchProgress {
  return {
    ...createEmptyProgress(10),
    totalCandidates: 10,
    ...overrides,
  }
}

describe('createThrottledProgressHandler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits INITIALIZING immediately', () => {
    const received: RandomSearchProgress[] = []
    const handler = createThrottledProgressHandler((p) => received.push(p), {
      intervalMs: 200,
    })

    handler.emit(progress({ candidatesTested: 0, status: 'INITIALIZING' }))
    expect(received).toHaveLength(1)
    expect(received[0]?.status).toBe('INITIALIZING')
  })

  it('throttles ordinary progress updates to the interval window', () => {
    vi.useFakeTimers()
    let now = 1_000
    const received: RandomSearchProgress[] = []
    const handler = createThrottledProgressHandler((p) => received.push({ ...p }), {
      intervalMs: 200,
      now: () => now,
    })

    handler.emit(progress({ candidatesTested: 0, status: 'INITIALIZING' }))
    expect(received).toHaveLength(1)

    now = 1_050
    handler.emit(
      progress({
        candidatesTested: 1,
        candidatesAccepted: 1,
        status: 'EXPLORING',
        bestScore: 1.1,
        improvementsCount: 1,
        candidatesSinceLastImprovement: 0,
      }),
    )
    // First post-init ordinary/improvement may be immediate because improvementsCount rose.
    expect(received.length).toBeGreaterThanOrEqual(2)

    const afterImprovement = received.length
    now = 1_060
    handler.emit(
      progress({
        candidatesTested: 2,
        candidatesAccepted: 1,
        candidatesRejected: 1,
        status: 'EXPLORING',
        bestScore: 1.1,
        improvementsCount: 1,
        candidatesSinceLastImprovement: 1,
        currentCandidateScore: 0.9,
      }),
    )
    // Within throttle window and no new best → deferred.
    expect(received).toHaveLength(afterImprovement)

    now = 1_260
    vi.advanceTimersByTime(200)
    expect(received).toHaveLength(afterImprovement + 1)
    expect(received.at(-1)?.candidatesTested).toBe(2)
  })

  it('emits immediately when a new best candidate is found', () => {
    vi.useFakeTimers()
    let now = 5_000
    const received: RandomSearchProgress[] = []
    const handler = createThrottledProgressHandler((p) => received.push({ ...p }), {
      intervalMs: 250,
      now: () => now,
    })

    handler.emit(progress({ candidatesTested: 0, status: 'INITIALIZING' }))

    now = 5_010
    handler.emit(
      progress({
        candidatesTested: 1,
        status: 'IMPROVING',
        bestScore: 1.0,
        bestTradeCount: 12,
        improvementsCount: 1,
        candidatesSinceLastImprovement: 0,
      }),
    )

    now = 5_020
    handler.emit(
      progress({
        candidatesTested: 2,
        status: 'EXPLORING',
        bestScore: 1.0,
        bestTradeCount: 12,
        improvementsCount: 1,
        candidatesSinceLastImprovement: 1,
      }),
    )
    const beforeBest = received.length

    now = 5_030
    handler.emit(
      progress({
        candidatesTested: 3,
        status: 'IMPROVING',
        bestScore: 1.7,
        bestTradeCount: 44,
        improvementsCount: 2,
        candidatesSinceLastImprovement: 0,
      }),
    )

    expect(received.length).toBe(beforeBest + 1)
    expect(received.at(-1)?.bestTradeCount).toBe(44)
    expect(received.at(-1)?.improvementsCount).toBe(2)
  })

  it('emits FINALIZING / FAILED / CANCELLED / COMPLETED immediately', () => {
    vi.useFakeTimers()
    let now = 10_000
    const statuses: RandomSearchProgress['status'][] = []
    const h = createThrottledProgressHandler((p) => statuses.push(p.status), {
      intervalMs: 200,
      now: () => now,
    })

    h.emit(progress({ candidatesTested: 0, status: 'INITIALIZING' }))
    now = 10_010
    h.emit(progress({ candidatesTested: 1, status: 'EXPLORING' }))
    now = 10_020
    h.emit(progress({ candidatesTested: 5, status: 'FINALIZING' }))
    expect(statuses.at(-1)).toBe('FINALIZING')

    now = 10_030
    h.emit(progress({ candidatesTested: 5, status: 'COMPLETED' }))
    expect(statuses.at(-1)).toBe('COMPLETED')

    now = 10_040
    h.emit(progress({ candidatesTested: 2, status: 'FAILED' }))
    expect(statuses.at(-1)).toBe('FAILED')

    now = 10_050
    h.emit(progress({ candidatesTested: 2, status: 'CANCELLED' }))
    expect(statuses.at(-1)).toBe('CANCELLED')
  })
})
