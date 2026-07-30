import { describe, expect, it } from 'vitest'
import {
  clipCandlesToRange,
  estimateCandleCount,
  formatSampleSizeMessage,
  mergeCandlePages,
  resolveResearchPeriod,
} from '../research-period'

describe('research-period helpers', () => {
  it('resolves last-30d / 90d / 1y relative to now', () => {
    const now = Date.parse('2026-07-30T12:00:00.000Z')
    const thirty = resolveResearchPeriod({ preset: 'last_30d' }, now)
    expect(thirty.endMs).toBe(now)
    expect(thirty.startMs).toBe(now - 30 * 86_400_000)
    expect(thirty.label).toBe('Last 30 days')

    const year = resolveResearchPeriod({ preset: 'last_1y' }, now)
    expect(year.startMs).toBe(now - 365 * 86_400_000)
  })

  it('resolves custom ranges and rejects inverted bounds', () => {
    const start = Date.parse('2026-01-01T00:00:00.000Z')
    const end = Date.parse('2026-03-01T23:59:59.999Z')
    const custom = resolveResearchPeriod({
      preset: 'custom',
      customStartMs: start,
      customEndMs: end,
    })
    expect(custom.startMs).toBe(start)
    expect(custom.endMs).toBe(end)

    expect(() =>
      resolveResearchPeriod({
        preset: 'custom',
        customStartMs: end,
        customEndMs: start,
      }),
    ).toThrow(/end must be on or after start/i)
  })

  it('estimates candle counts for interval × period', () => {
    const start = 0
    const end = 30 * 86_400_000
    // 30 days of 15m ≈ 2881 inclusive ticks
    expect(estimateCandleCount(start, end, '15m')).toBe(2881)
    expect(estimateCandleCount(start, end, '1h')).toBe(721)
  })

  it('merges pages chronologically and deduplicates by open time', () => {
    const merged = mergeCandlePages([
      [
        { time: 300, open: 3 },
        { time: 100, open: 1 },
      ],
      [
        { time: 100, open: 1.5 },
        { time: 200, open: 2 },
      ],
    ])
    expect(merged.map((c) => c.time)).toEqual([100, 200, 300])
    expect(merged[0]?.open).toBe(1.5)
  })

  it('clips candles to an inclusive start/end window', () => {
    const candles = [
      { time: 100 },
      { time: 200 },
      { time: 300 },
      { time: 400 },
    ]
    expect(clipCandlesToRange(candles, 200, 300).map((c) => c.time)).toEqual([200, 300])
  })

  it('formats sample-size messaging with period coverage', () => {
    const start = Date.parse('2026-07-25T00:00:00.000Z')
    const end = Date.parse('2026-07-30T04:48:00.000Z')
    const message = formatSampleSizeMessage({
      totalTrades: 5,
      candleCount: 500,
      interval: '15m',
      startMs: start,
      endMs: end,
    })
    expect(message).toContain('5 trades from 500 × 15m candles')
    expect(message).toMatch(/~5\.2 days/)
    expect(message).toContain('Extend the research period for stronger evidence')
  })
})
