import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  aggregateOutcomeStats,
  detectDirectConsumptionSetups,
  measureSetupOutcome,
  measureSetupOutcomes,
} from '@/core/candle-research'

const STEP = 15 * 60_000

function candle(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return {
    time: i * STEP,
    open,
    high,
    low,
    close,
    volume: 1,
  }
}

describe('candle research outcome measurement', () => {
  it('measures deterministic MFE/MAE and time-to-target for bullish-reference recovery', () => {
    const candles = [
      candle(0, 100, 111, 99, 110),
      candle(1, 111, 112, 103, 104),
      candle(2, 104, 106, 102, 105),
      candle(3, 105, 109, 103, 108),
      candle(4, 108, 111, 101, 102),
      candle(5, 102, 108, 100, 107),
    ]

    const setup = detectDirectConsumptionSetups(candles).find((s) => s.penetrationThreshold === 70)
    expect(setup).toBeDefined()

    const outcome = measureSetupOutcome({ candles, setup: setup!, interval: '15m' })

    expect(outcome.mfePrice).toBe(7)
    expect(outcome.maePrice).toBe(4)
    expect(outcome.timeToMfeMs).toBe(45 * 60_000)
    expect(outcome.timeToRecoveryMs['0.25']).toBe(30 * 60_000)
    expect(outcome.timeToRecoveryMs['0.50']).toBe(45 * 60_000)
    expect(outcome.timeToRecoveryMs['0.75']).toBeNull()
    expect(outcome.previousHighRetested).toBe(true)
    expect(outcome.previousLowRetested).toBe(false)
    expect(outcome.oppositeExtremeBroken).toBe(false)

    const byLabel = Object.fromEntries(outcome.windows.map((window) => [window.label, window]))
    expect(byLabel['+15m']?.mfePrice).toBe(2)
    expect(byLabel['+30m']?.mfePrice).toBe(5)
    expect(byLabel['+1h']?.mfePrice).toBe(7)
  })

  it('mirrors bearish-reference outcome direction and retest flags', () => {
    const candles = [
      candle(0, 120, 121, 109, 110),
      candle(1, 109, 117, 108, 116),
      candle(2, 116, 118, 114, 115),
      candle(3, 115, 117, 111, 112),
      candle(4, 112, 119, 108, 111),
    ]

    const setup = detectDirectConsumptionSetups(candles).find((s) => s.penetrationThreshold === 70)
    expect(setup).toBeDefined()

    const outcome = measureSetupOutcome({ candles, setup: setup!, interval: '15m' })

    expect(outcome.mfePrice).toBe(8)
    expect(outcome.maePrice).toBe(3)
    expect(outcome.previousLowRetested).toBe(true)
    expect(outcome.previousHighRetested).toBe(false)
    expect(outcome.oppositeExtremeBroken).toBe(false)
    expect(outcome.timeToRecoveryMs['0.25']).toBe(30 * 60_000)
  })

  it('builds aggregate stats grouped by penetration threshold', () => {
    const candles = [
      candle(0, 100, 111, 99, 110),
      candle(1, 111, 112, 103, 104),
      candle(2, 104, 107, 102, 106),
      candle(3, 106, 112, 101, 111),
      candle(4, 111, 113, 109, 112),
    ]

    const setups = detectDirectConsumptionSetups(candles)
    const outcomes = measureSetupOutcomes({ candles, setups, interval: '15m' })
    const aggregate = aggregateOutcomeStats(outcomes)

    expect(aggregate.totalSetups).toBeGreaterThan(0)
    expect(aggregate.byPenetrationThreshold).toHaveLength(5)
    expect(aggregate.byPenetrationThreshold.find((g) => g.threshold === 40)?.totalSetups).toBeGreaterThan(
      0,
    )
  })
})
