import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  calculateRetracementDepthIntoPrevious,
  classifyPreviousBreak,
  detectDirectConsumptionSetups,
  extractCandleFeatures,
} from '../index.js'

function candle(input: Omit<Candle, 'volume'> & { volume?: number }): Candle {
  return {
    volume: input.volume ?? 100,
    ...input,
  }
}

describe('candle research feature extraction', () => {
  it('extracts candle geometry and previous-candle references', () => {
    const candles: Candle[] = [
      candle({ time: 1, open: 100, high: 112, low: 99, close: 110 }),
      candle({ time: 2, open: 109, high: 111, low: 103, close: 104 }),
    ]

    const features = extractCandleFeatures(candles)
    const first = features[0]!
    const second = features[1]!

    expect(first.bullish).toBe(true)
    expect(first.bodySize).toBe(10)
    expect(first.fullRange).toBe(13)
    expect(first.upperWick).toBe(2)
    expect(first.lowerWick).toBe(1)
    expect(first.previous).toBeNull()

    expect(second.bearish).toBe(true)
    expect(second.previous?.time).toBe(1)
    expect(second.previous?.direction).toBe('BULLISH')
    expect(second.bodyRangeRatio).toBeCloseTo(0.625)
    expect(second.upperWickRangeRatio).toBeCloseTo(0.25)
    expect(second.lowerWickRangeRatio).toBeCloseTo(0.125)
  })

  it('classifies previous high/low breaks as HIGH_ONLY / LOW_ONLY / BOTH / NEITHER', () => {
    expect(
      classifyPreviousBreak({
        brokePreviousHigh: true,
        brokePreviousLow: false,
      }),
    ).toBe('HIGH_ONLY')
    expect(
      classifyPreviousBreak({
        brokePreviousHigh: false,
        brokePreviousLow: true,
      }),
    ).toBe('LOW_ONLY')
    expect(
      classifyPreviousBreak({
        brokePreviousHigh: true,
        brokePreviousLow: true,
      }),
    ).toBe('BOTH')
    expect(
      classifyPreviousBreak({
        brokePreviousHigh: false,
        brokePreviousLow: false,
      }),
    ).toBe('NEITHER')
  })

  it('calculates retracement depth into previous candle body (bullish and bearish references)', () => {
    const bullishDepth = calculateRetracementDepthIntoPrevious({
      candle: candle({ time: 2, open: 108, high: 109, low: 104, close: 105 }),
      previous: {
        index: 0,
        time: 1,
        open: 100,
        high: 111,
        low: 98,
        close: 110,
        direction: 'BULLISH',
      },
    })

    const bearishDepth = calculateRetracementDepthIntoPrevious({
      candle: candle({ time: 4, open: 96, high: 100, low: 94, close: 99 }),
      previous: {
        index: 2,
        time: 3,
        open: 102,
        high: 104,
        low: 95,
        close: 96,
        direction: 'BEARISH',
      },
    })

    expect(bullishDepth).toBeCloseTo(0.6)
    expect(bearishDepth).toBeCloseTo(0.6666666)
  })
})

describe('direct consumption detector', () => {
  it('detects bullish and bearish reference setups and tracks threshold penetration', () => {
    const candles: Candle[] = [
      candle({ time: 1, open: 100, high: 112, low: 99, close: 110 }), // bullish reference
      candle({ time: 2, open: 109, high: 110, low: 103, close: 104 }), // bearish move into previous body (70%)
      candle({ time: 3, open: 108, high: 109, low: 95, close: 96 }), // bearish reference
      candle({ time: 4, open: 97, high: 106, low: 96, close: 105 }), // bullish move into previous body (83.3%)
    ]

    const features = extractCandleFeatures(candles)
    const setups = detectDirectConsumptionSetups(features)

    expect(setups).toHaveLength(2)

    expect(setups[0]).toMatchObject({
      hypothesis: 'DIRECT_CONSUMPTION',
      referenceType: 'BULLISH_REFERENCE',
      candleIndex: 1,
      referenceCandleIndex: 0,
    })
    expect(setups[0]?.penetrationDepth).toBeCloseTo(0.7)
    expect(setups[0]?.penetrationThresholdsHit).toEqual([0.4, 0.5, 0.6, 0.7])

    expect(setups[1]).toMatchObject({
      referenceType: 'BEARISH_REFERENCE',
      candleIndex: 3,
      referenceCandleIndex: 2,
    })
    expect(setups[1]?.penetrationThresholdsHit).toEqual([0.4, 0.5, 0.6, 0.7, 0.8])
  })
})
