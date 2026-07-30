import { describe, expect, it } from 'vitest'
import {
  createEmptyProgress,
  deriveLiveSearchStatus,
  estimateRemainingMs,
  formatDurationMs,
  isBestImprovement,
} from '../progress.js'

describe('random search progress helpers', () => {
  it('creates an INITIALIZING empty progress payload', () => {
    const progress = createEmptyProgress(25)
    expect(progress).toMatchObject({
      totalCandidates: 25,
      candidatesTested: 0,
      candidatesAccepted: 0,
      candidatesRejected: 0,
      bestScore: null,
      bestTradeCount: null,
      improvementsCount: 0,
      status: 'INITIALIZING',
    })
  })

  it('derives EXPLORING / IMPROVING / PLATEAUING from tracker state', () => {
    expect(
      deriveLiveSearchStatus({
        tested: 0,
        total: 20,
        bestScore: null,
        candidatesSinceLastImprovement: null,
        justImproved: false,
      }),
    ).toBe('EXPLORING')

    expect(
      deriveLiveSearchStatus({
        tested: 8,
        total: 20,
        bestScore: 1.4,
        candidatesSinceLastImprovement: 0,
        justImproved: true,
      }),
    ).toBe('IMPROVING')

    expect(
      deriveLiveSearchStatus({
        tested: 40,
        total: 50,
        bestScore: 1.4,
        candidatesSinceLastImprovement: 20,
        justImproved: false,
      }),
    ).toBe('PLATEAUING')
  })

  it('estimates remaining time from average candidate duration', () => {
    expect(
      estimateRemainingMs({
        elapsedMs: 1_000,
        candidatesTested: 4,
        totalCandidates: 10,
      }),
    ).toBe(1_500)

    expect(
      estimateRemainingMs({
        elapsedMs: 0,
        candidatesTested: 0,
        totalCandidates: 10,
      }),
    ).toBeNull()
  })

  it('formats durations for the live panel', () => {
    expect(formatDurationMs(null)).toBe('—')
    expect(formatDurationMs(4_500)).toBe('5s')
    expect(formatDurationMs(65_000)).toBe('1m 05s')
  })

  it('detects best-improvement transitions for immediate emit', () => {
    const previous = createEmptyProgress(10)
    previous.candidatesTested = 2
    previous.bestScore = 1.1
    previous.improvementsCount = 1
    previous.status = 'EXPLORING'

    const next = { ...previous, bestScore: 1.8, improvementsCount: 2, bestTradeCount: 22 }
    expect(isBestImprovement(previous, next)).toBe(true)
    expect(isBestImprovement(previous, { ...previous, candidatesTested: 3 })).toBe(false)
  })
})
