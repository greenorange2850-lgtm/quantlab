import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import { detectDirectConsumptionSetups, extractCandleFeatures } from '@/core/candle-research'

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

describe('candle research feature extraction', () => {
  it('computes body/range ratios, break classes, and retracement depth', () => {
    const candles = [
      candle(0, 100, 112, 98, 110),
      candle(1, 111, 115, 97, 104),
      candle(2, 104, 107, 102, 106),
    ]

    const features = extractCandleFeatures(candles)

    expect(features).toHaveLength(3)
    expect(features[1]?.bullish).toBe(false)
    expect(features[1]?.bearish).toBe(true)
    expect(features[1]?.bodySize).toBe(7)
    expect(features[1]?.fullRange).toBe(18)
    expect(features[1]?.breakClassification).toBe('BOTH')
    expect(features[1]?.brokePreviousHigh).toBe(true)
    expect(features[1]?.brokePreviousLow).toBe(true)
    expect(features[1]?.retracementDepthIntoPreviousCandle).toBeGreaterThan(0)
  })
})

describe('direct consumption detector', () => {
  it('detects bullish and bearish mirrored direct-consumption setups across thresholds', () => {
    const candles = [
      candle(0, 100, 111, 99, 110), // bullish reference
      candle(1, 111, 112, 103, 104), // bearish into body (~70%)
      candle(2, 120, 121, 109, 110), // bearish reference
      candle(3, 109, 117, 108, 116), // bullish into body (~70%)
    ]

    const setups = detectDirectConsumptionSetups(candles)

    expect(setups).toHaveLength(8)
    const bull = setups.filter((s) => s.referenceDirection === 'bullish-reference')
    const bear = setups.filter((s) => s.referenceDirection === 'bearish-reference')

    expect(bull).toHaveLength(4)
    expect(bear).toHaveLength(4)
    expect(new Set(bull.map((s) => s.penetrationThreshold))).toEqual(new Set([40, 50, 60, 70]))
    expect(new Set(bear.map((s) => s.penetrationThreshold))).toEqual(new Set([40, 50, 60, 70]))
    expect(bull.every((s) => s.measurementDirection === 'up')).toBe(true)
    expect(bear.every((s) => s.measurementDirection === 'down')).toBe(true)
  })

  it('remains no-look-ahead: earlier setup detections do not change when future candles are appended', () => {
    const base = [
      candle(0, 100, 111, 99, 110),
      candle(1, 111, 112, 103, 104),
      candle(2, 104, 106, 101, 102),
      candle(3, 102, 105, 100, 104),
    ]

    const extended = [
      ...base,
      candle(4, 104, 120, 103, 119),
      candle(5, 119, 121, 111, 112),
    ]

    const fromBase = detectDirectConsumptionSetups(base)
    const fromExtended = detectDirectConsumptionSetups(extended).filter(
      (setup) => setup.setupTime <= base.at(-1)!.time,
    )

    expect(fromExtended).toEqual(fromBase)
  })
})
