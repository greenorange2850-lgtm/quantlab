import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  acceptanceStatusForModule,
  buildModuleMetrics,
  cloneSmcDetectorConfig,
  createGoldenDatasetId,
  DEFAULT_SMC_MATCH_TOLERANCE,
  detectSmc,
  evaluateSmcValidation,
  goldenLabelFromProbe,
  matchGoldenLabels,
  PHASE1_COMPAT_SMC_CONFIG,
  precisionRecall,
  scoreEventMatch,
  toDetectedProbes,
  validateProgressiveConsistency,
  type SmcDetectedEventProbe,
  type SmcGoldenDataset,
  type SmcGoldenLabel,
} from '@/core/smc'

function candle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return {
    time: 1_700_000_000_000 + index * 3_600_000,
    open,
    high,
    low,
    close,
    volume: 1,
  }
}

function label(partial: Partial<SmcGoldenLabel> & Pick<SmcGoldenLabel, 'id' | 'kind'>): SmcGoldenLabel {
  return {
    module: 'Swing',
    candleIndex: 10,
    timestamp: 1_700_000_000_000 + 10 * 3_600_000,
    price: 100,
    createdAt: 1,
    ...partial,
  }
}

function probe(
  partial: Partial<SmcDetectedEventProbe> & Pick<SmcDetectedEventProbe, 'id' | 'kind'>,
): SmcDetectedEventProbe {
  return {
    candleIndex: 10,
    timestamp: 1_700_000_000_000 + 10 * 3_600_000,
    price: 100,
    knowableAtIndex: 10,
    sourceStructureId: null,
    ...partial,
  }
}

describe('SMC event matching', () => {
  it('matches true positives by kind + exact timestamp/price', () => {
    const expected = [label({ id: 'g1', kind: 'SWING_HIGH', price: 100, candleIndex: 10 })]
    const detected = [probe({ id: 'd1', kind: 'SWING_HIGH', price: 100, candleIndex: 10 })]
    const result = matchGoldenLabels(expected, detected)
    expect(result.matched).toHaveLength(1)
    expect(result.missed).toHaveLength(0)
    expect(result.extra).toHaveLength(0)
    expect(result.matched[0]!.expectedId).toBe('g1')
    expect(result.matched[0]!.detectedId).toBe('d1')
  })

  it('counts unmatched detections as false positives (extra)', () => {
    const expected = [label({ id: 'g1', kind: 'SWING_HIGH' })]
    const detected = [
      probe({ id: 'd1', kind: 'SWING_HIGH' }),
      probe({ id: 'd2', kind: 'SWING_LOW', price: 90, candleIndex: 12, timestamp: 12 }),
    ]
    const result = matchGoldenLabels(expected, detected, {
      ...DEFAULT_SMC_MATCH_TOLERANCE,
      timestampToleranceMs: 1e15,
      candleIndexTolerance: 100,
    })
    expect(result.matched).toHaveLength(1)
    expect(result.extra.map((e) => e.id)).toEqual(['d2'])
  })

  it('counts unmatched expected labels as false negatives (missed)', () => {
    const expected = [
      label({ id: 'g1', kind: 'SWING_HIGH' }),
      label({ id: 'g2', kind: 'SWING_LOW', price: 90, candleIndex: 12 }),
    ]
    const detected = [probe({ id: 'd1', kind: 'SWING_HIGH' })]
    const result = matchGoldenLabels(expected, detected)
    expect(result.matched).toHaveLength(1)
    expect(result.missed.map((m) => m.id)).toEqual(['g2'])
  })

  it('respects timestamp tolerance', () => {
    const expected = label({
      id: 'g1',
      kind: 'BULLISH_BOS',
      module: 'BOS',
      timestamp: 1000,
      candleIndex: 5,
      price: 110,
    })
    const detected = probe({
      id: 'd1',
      kind: 'BULLISH_BOS',
      timestamp: 1400,
      candleIndex: 5,
      price: 110,
    })
    expect(scoreEventMatch(expected, detected, { ...DEFAULT_SMC_MATCH_TOLERANCE, timestampToleranceMs: 300 })).toBeNull()
    expect(
      scoreEventMatch(expected, detected, {
        ...DEFAULT_SMC_MATCH_TOLERANCE,
        timestampToleranceMs: 500,
      }),
    ).not.toBeNull()
  })

  it('respects price tolerance percent', () => {
    const expected = label({ id: 'g1', kind: 'SWING_HIGH', price: 100 })
    const detected = probe({ id: 'd1', kind: 'SWING_HIGH', price: 100.2 })
    // 0.2% > 0.05% default
    expect(scoreEventMatch(expected, detected, DEFAULT_SMC_MATCH_TOLERANCE)).toBeNull()
    expect(
      scoreEventMatch(expected, detected, {
        ...DEFAULT_SMC_MATCH_TOLERANCE,
        priceTolerancePercent: 0.25,
      }),
    ).not.toBeNull()
  })

  it('requires source structure id when present on both sides', () => {
    const expected = label({
      id: 'g1',
      kind: 'BULLISH_BOS',
      module: 'BOS',
      sourceStructureId: 'sh-1',
      price: 110,
    })
    const wrong = probe({
      id: 'd1',
      kind: 'BULLISH_BOS',
      sourceStructureId: 'sh-2',
      price: 110,
    })
    const right = probe({
      id: 'd2',
      kind: 'BULLISH_BOS',
      sourceStructureId: 'sh-1',
      price: 110,
    })
    expect(scoreEventMatch(expected, wrong)).toBeNull()
    expect(scoreEventMatch(expected, right)).not.toBeNull()
  })
})

describe('SMC validation metrics', () => {
  it('calculates precision and recall', () => {
    expect(precisionRecall(8, 2, 2)).toEqual({ precision: 0.8, recall: 0.8 })
    expect(precisionRecall(0, 0, 0)).toEqual({ precision: null, recall: null })
  })

  it('assigns acceptance gates from reviewed samples only', () => {
    expect(
      acceptanceStatusForModule({
        module: 'BOS',
        precision: 0.95,
        recall: 0.9,
        reviewedSampleCount: 0,
      }),
    ).toBe('Experimental')

    expect(
      acceptanceStatusForModule({
        module: 'BOS',
        precision: 0.7,
        recall: 0.7,
        reviewedSampleCount: 20,
      }),
    ).toBe('Needs Tuning')

    expect(
      acceptanceStatusForModule({
        module: 'BOS',
        precision: 0.91,
        recall: 0.8,
        reviewedSampleCount: 12,
      }),
    ).toBe('Usable')

    expect(
      acceptanceStatusForModule({
        module: 'FVG',
        precision: 0.99,
        recall: 0.95,
        reviewedSampleCount: 40,
      }),
    ).toBe('Verified')
  })

  it('buildModuleMetrics wires TP/FP/FN and agreement', () => {
    const m = buildModuleMetrics({
      module: 'Swing',
      truePositives: 9,
      falsePositives: 1,
      falseNegatives: 1,
      reviewedCorrect: 9,
      reviewedWrong: 1,
      unsureCount: 2,
    })
    expect(m.precision).toBeCloseTo(0.9)
    expect(m.recall).toBeCloseTo(0.9)
    expect(m.reviewedAgreement).toBeCloseTo(0.9)
    expect(m.unsureCount).toBe(2)
    expect(m.status).toBe('Usable')
  })
})

describe('progressive / look-ahead validation', () => {
  it('reports progressive final equals full-history for phase1 config', () => {
    const candles = Array.from({ length: 40 }, (_, i) => {
      const c = 100 + Math.sin(i / 4) * 3
      return candle(i, c, c + 1, c - 1, c)
    })
    candles[10] = candle(10, 100, 108, 99, 107)
    candles[20] = candle(20, 107, 108, 95, 96)
    const report = validateProgressiveConsistency(
      candles,
      cloneSmcDetectorConfig(PHASE1_COMPAT_SMC_CONFIG),
    )
    expect(report.missingInProgressive).toEqual([])
    expect(report.extraInProgressive).toEqual([])
    expect(report.lookAheadViolations).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('detects no look-ahead: events absent before knowable index', () => {
    const candles = Array.from({ length: 50 }, (_, i) => candle(i, 50, 51, 49, 50))
    // Create a clear swing high mid-series
    for (let i = 0; i < 50; i++) {
      const c = 100 + (i < 15 ? i : i > 25 ? 30 - i : 15)
      candles[i] = candle(i, c, c + 0.5, c - 0.5, c)
    }
    const config = cloneSmcDetectorConfig(PHASE1_COMPAT_SMC_CONFIG)
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const full = detectSmc(candles, config)
    const probes = toDetectedProbes(full)
    expect(probes.length).toBeGreaterThan(0)
    const report = validateProgressiveConsistency(candles, config)
    expect(report.lookAheadViolations).toEqual([])
  })
})

describe('golden dataset evaluation', () => {
  it('separates metrics by detector version / config fingerprint', () => {
    const candles = Array.from({ length: 30 }, (_, i) => candle(i, 100, 101, 99, 100))
    const detection = detectSmc(candles, cloneSmcDetectorConfig(PHASE1_COMPAT_SMC_CONFIG))
    const probes = toDetectedProbes(detection)
    const labels = probes.slice(0, Math.min(2, probes.length)).map((p) => goldenLabelFromProbe(p))
    const dataset: SmcGoldenDataset = {
      id: createGoldenDatasetId({
        datasetKey: 'binance:BTCUSDT:1h',
        detectorVersion: 'test-v1',
        configFingerprint: 'fp-a',
      }),
      name: 'test',
      sourceKind: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      datasetKey: 'binance:BTCUSDT:1h',
      startMs: null,
      endMs: null,
      detectorVersion: 'test-v1',
      configFingerprint: 'fp-a',
      labels,
      createdAt: 1,
      updatedAt: 1,
    }

    const reportA = evaluateSmcValidation({
      dataset,
      detection,
      reviews: [
        {
          eventId: 'x',
          kind: 'SWING_HIGH',
          module: 'Swing',
          verdict: 'wrong',
          reasonTags: ['noise'],
          configFingerprint: 'fp-a',
          detectorVersion: 'test-v1',
        },
        {
          eventId: 'y',
          kind: 'SWING_HIGH',
          module: 'Swing',
          verdict: 'wrong',
          reasonTags: ['noise'],
          configFingerprint: 'fp-b',
          detectorVersion: 'test-v1',
        },
        {
          eventId: 'z',
          kind: 'SWING_HIGH',
          module: 'Swing',
          verdict: 'wrong',
          reasonTags: ['noise'],
          configFingerprint: 'fp-a',
          detectorVersion: 'other',
        },
      ],
    })

    expect(reportA.reviewedSampleCount).toBe(1)
    expect(reportA.wrongReasonTags[0]?.tag).toBe('noise')
    expect(reportA.detectorVersion).toBe('test-v1')
    expect(reportA.configFingerprint).toBe('fp-a')
  })
})
