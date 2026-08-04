import { describe, expect, it } from 'vitest'
import {
  analyzeDowTheory,
  classifyDowSwingProgression,
  detectSmc,
  detectSmcUntil,
  DEFAULT_SMC_DETECTOR_CONFIG,
  toDowTheorySnapshot,
  type DowTheoryClassifiedSwing,
} from '@/core/smc'
import type { Candle } from '@/data/candles'

function swing(
  partial: Omit<DowTheoryClassifiedSwing, 'classification'> & {
    classification?: 'INTERNAL' | 'EXTERNAL'
  },
): DowTheoryClassifiedSwing {
  return {
    classification: 'EXTERNAL',
    ...partial,
  }
}

/** Classic bullish: HL then HH repeating. */
function bullishExternalSequence(): DowTheoryClassifiedSwing[] {
  return [
    swing({
      id: 'e-l1',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 10,
      confirmedAtIndex: 12,
      price: 100,
    }),
    swing({
      id: 'e-h1',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 20,
      confirmedAtIndex: 22,
      price: 120,
    }),
    swing({
      id: 'e-l2',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 30,
      confirmedAtIndex: 32,
      price: 110,
    }),
    swing({
      id: 'e-h2',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 40,
      confirmedAtIndex: 42,
      price: 130,
    }),
    swing({
      id: 'e-l3',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 50,
      confirmedAtIndex: 52,
      price: 115,
    }),
    swing({
      id: 'e-h3',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 60,
      confirmedAtIndex: 62,
      price: 140,
    }),
  ]
}

/** Classic bearish: LH then LL repeating. */
function bearishExternalSequence(): DowTheoryClassifiedSwing[] {
  return [
    swing({
      id: 'e-h1',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 10,
      confirmedAtIndex: 12,
      price: 140,
    }),
    swing({
      id: 'e-l1',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 20,
      confirmedAtIndex: 22,
      price: 120,
    }),
    swing({
      id: 'e-h2',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 30,
      confirmedAtIndex: 32,
      price: 130,
    }),
    swing({
      id: 'e-l2',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 40,
      confirmedAtIndex: 42,
      price: 110,
    }),
    swing({
      id: 'e-h3',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 50,
      confirmedAtIndex: 52,
      price: 125,
    }),
    swing({
      id: 'e-l3',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 60,
      confirmedAtIndex: 62,
      price: 100,
    }),
  ]
}

describe('Dow Theory swing progression', () => {
  it('labels bullish sequence HH / HL', () => {
    const metas = classifyDowSwingProgression(bullishExternalSequence(), 100)
    const byId = Object.fromEntries(metas.map((m) => [m.swingId, m.label]))
    expect(byId['e-l1']).toBeNull()
    expect(byId['e-h1']).toBeNull()
    expect(byId['e-l2']).toBe('HL')
    expect(byId['e-h2']).toBe('HH')
    expect(byId['e-l3']).toBe('HL')
    expect(byId['e-h3']).toBe('HH')
  })

  it('labels bearish sequence LH / LL', () => {
    const metas = classifyDowSwingProgression(bearishExternalSequence(), 100)
    const byId = Object.fromEntries(metas.map((m) => [m.swingId, m.label]))
    expect(byId['e-h2']).toBe('LH')
    expect(byId['e-l2']).toBe('LL')
    expect(byId['e-h3']).toBe('LH')
    expect(byId['e-l3']).toBe('LL')
  })
})

describe('Dow Theory trend inference', () => {
  it('infers bullish sequence', () => {
    const layer = analyzeDowTheory(bullishExternalSequence(), 100)
    expect(layer.trend).toBe('Bullish')
    expect(layer.structurePhase).toBe('IMPULSE')
    expect(layer.strength).toBeGreaterThan(40)
    expect(layer.diagnostics.hhCount).toBeGreaterThanOrEqual(2)
    expect(layer.diagnostics.hlCount).toBeGreaterThanOrEqual(2)
    expect(layer.diagnostics.currentTrend).toBe('Bullish')
    expect(layer.latestExternalSwing?.swingId).toBe('e-h3')
  })

  it('infers bearish sequence', () => {
    const layer = analyzeDowTheory(bearishExternalSequence(), 100)
    expect(layer.trend).toBe('Bearish')
    expect(layer.structurePhase).toBe('IMPULSE')
    expect(layer.strength).toBeGreaterThan(40)
    expect(layer.diagnostics.lhCount).toBeGreaterThanOrEqual(2)
    expect(layer.diagnostics.llCount).toBeGreaterThanOrEqual(2)
  })

  it('infers pullback inside bullish structure', () => {
    const swings: DowTheoryClassifiedSwing[] = [
      ...bullishExternalSequence().slice(0, 4),
      // Internal lower high while external still bullish HL/HH
      swing({
        id: 'i-h1',
        kind: 'INTERNAL_SWING_HIGH',
        candleIndex: 44,
        confirmedAtIndex: 46,
        price: 128,
        classification: 'INTERNAL',
      }),
      swing({
        id: 'i-h2',
        kind: 'INTERNAL_SWING_HIGH',
        candleIndex: 48,
        confirmedAtIndex: 50,
        price: 126,
        classification: 'INTERNAL',
      }),
    ]
    const layer = analyzeDowTheory(swings, 100)
    expect(layer.trend).toBe('Pullback')
    expect(layer.structurePhase).toBe('PULLBACK')
    expect(layer.latestInternalSwing?.swingId).toBe('i-h2')
  })

  it('infers reversal from bullish to bearish', () => {
    const swings: DowTheoryClassifiedSwing[] = [
      ...bullishExternalSequence(),
      // Break down: lower high + lower low
      swing({
        id: 'e-h4',
        kind: 'EXTERNAL_SWING_HIGH',
        candleIndex: 70,
        confirmedAtIndex: 72,
        price: 135,
      }),
      swing({
        id: 'e-l4',
        kind: 'EXTERNAL_SWING_LOW',
        candleIndex: 80,
        confirmedAtIndex: 82,
        price: 105,
      }),
      swing({
        id: 'e-h5',
        kind: 'EXTERNAL_SWING_HIGH',
        candleIndex: 90,
        confirmedAtIndex: 92,
        price: 125,
      }),
      swing({
        id: 'e-l5',
        kind: 'EXTERNAL_SWING_LOW',
        candleIndex: 100,
        confirmedAtIndex: 102,
        price: 95,
      }),
    ]
    const layer = analyzeDowTheory(swings, 200)
    expect(layer.trend).toBe('Reversal')
    expect(layer.structurePhase).toBe('REVERSAL')
  })

  it('infers ranging structure', () => {
    const swings: DowTheoryClassifiedSwing[] = [
      swing({
        id: 'e-h1',
        kind: 'EXTERNAL_SWING_HIGH',
        candleIndex: 10,
        confirmedAtIndex: 12,
        price: 120,
      }),
      swing({
        id: 'e-l1',
        kind: 'EXTERNAL_SWING_LOW',
        candleIndex: 20,
        confirmedAtIndex: 22,
        price: 100,
      }),
      swing({
        id: 'e-h2',
        kind: 'EXTERNAL_SWING_HIGH',
        candleIndex: 30,
        confirmedAtIndex: 32,
        price: 118,
      }),
      swing({
        id: 'e-l2',
        kind: 'EXTERNAL_SWING_LOW',
        candleIndex: 40,
        confirmedAtIndex: 42,
        price: 102,
      }),
      swing({
        id: 'e-h3',
        kind: 'EXTERNAL_SWING_HIGH',
        candleIndex: 50,
        confirmedAtIndex: 52,
        price: 121,
      }),
      swing({
        id: 'e-l3',
        kind: 'EXTERNAL_SWING_LOW',
        candleIndex: 60,
        confirmedAtIndex: 62,
        price: 99,
      }),
    ]
    const layer = analyzeDowTheory(swings, 100)
    expect(['Range', 'Pullback']).toContain(layer.trend)
    expect(['RANGE', 'PULLBACK']).toContain(layer.structurePhase)
  })
})

describe('Dow Theory immutability + snapshot API', () => {
  it('does not mutate classified swing objects', () => {
    const swings = bullishExternalSequence()
    const before = JSON.stringify(swings)
    const layer = analyzeDowTheory(swings, 100)
    expect(JSON.stringify(swings)).toBe(before)
    const snapshot = toDowTheorySnapshot(layer)
    expect(snapshot).toMatchObject({
      trend: layer.trend,
      strength: layer.strength,
      structurePhase: layer.structurePhase,
    })
    expect(snapshot.swingClassification['e-h2']).toBe('HH')
  })

  it('exposes required public fields', () => {
    const layer = analyzeDowTheory(bullishExternalSequence(), 100)
    expect(layer).toEqual(
      expect.objectContaining({
        trend: expect.any(String),
        strength: expect.any(Number),
        structurePhase: expect.any(String),
        swingClassification: expect.any(Object),
        latestExternalSwing: expect.any(Object),
      }),
    )
    expect(layer.strength).toBeGreaterThanOrEqual(0)
    expect(layer.strength).toBeLessThanOrEqual(100)
  })
})

describe('Dow Theory progressive replay', () => {
  it('future swings do not affect earlier progressive view', () => {
    const swings = bullishExternalSequence()
    const early = analyzeDowTheory(swings, 35)
    expect(early.swingClassification['e-h2']).toBeUndefined()
    expect(early.swings.every((s) => s.confirmedAtIndex <= 35)).toBe(true)

    const mid = analyzeDowTheory(swings, 42)
    expect(mid.swingClassification['e-h2']).toBe('HH')

    const full = analyzeDowTheory(swings, 100)
    // Progressive at final confirm index equals full-history analysis at that index
    const atFinal = analyzeDowTheory(swings, 62)
    expect(atFinal.trend).toBe(full.trend)
    expect(atFinal.swingClassification).toEqual(full.swingClassification)
  })

  it('progressive pipeline output equals full-history at final candle', () => {
    const n = 120
    const candles: Candle[] = Array.from({ length: n }, (_, i) => {
      // Gentle uptrend with oscillating swings
      const base = 1000 + i * 0.8 + Math.sin(i / 5) * 12
      return {
        time: 1_700_000_000_000 + i * 3_600_000,
        open: base,
        high: base + 4 + (i % 7),
        low: base - 4 - (i % 5),
        close: base + ((i % 3) - 1) * 1.5,
        volume: 1,
      }
    })
    // Inject clearer external pivots
    candles[20] = { ...candles[20]!, high: 1080, close: 1070 }
    candles[40] = { ...candles[40]!, low: 980, close: 990 }
    candles[60] = { ...candles[60]!, high: 1120, close: 1110 }
    candles[80] = { ...candles[80]!, low: 1000, close: 1010 }
    candles[100] = { ...candles[100]!, high: 1160, close: 1150 }

    const full = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const progressive = detectSmcUntil(candles, n - 1, DEFAULT_SMC_DETECTOR_CONFIG)

    expect(progressive.dowTheory).toBeDefined()
    expect(full.dowTheory).toBeDefined()
    expect(progressive.dowTheory!.trend).toBe(full.dowTheory!.trend)
    expect(progressive.dowTheory!.strength).toBe(full.dowTheory!.strength)
    expect(progressive.dowTheory!.structurePhase).toBe(full.dowTheory!.structurePhase)
    expect(progressive.dowTheory!.swingClassification).toEqual(
      full.dowTheory!.swingClassification,
    )
    expect(progressive.diagnostics.dowTheory).toEqual(full.diagnostics.dowTheory)

    // Mid-replay: no look-ahead — swing confirmed later must be absent
    const midIndex = 50
    const mid = detectSmcUntil(candles, midIndex, DEFAULT_SMC_DETECTOR_CONFIG)
    for (const meta of mid.dowTheory!.swings) {
      expect(meta.confirmedAtIndex).toBeLessThanOrEqual(midIndex)
    }
    for (const s of full.classifiedSwings) {
      if (s.confirmedAtIndex > midIndex) {
        expect(mid.dowTheory!.swingClassification[s.id]).toBeUndefined()
      }
    }
  })
})
