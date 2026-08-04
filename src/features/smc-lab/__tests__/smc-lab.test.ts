import { describe, expect, it, beforeEach } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  cloneSmcDetectorConfig,
  DEFAULT_SMC_DETECTOR_CONFIG,
  detectSmc,
} from '@/core/smc'
import {
  buildDatasetKey,
  buildEventFingerprint,
  createReviewId,
  hashSmcConfig,
  type SmcLabExportPayload,
  type SmcManualAnnotation,
  type SmcReviewRecord,
} from '@/features/smc-lab/persistence/types'
import {
  MemorySmcLabStore,
  setSmcLabStoreForTests,
  validateSmcLabExport,
} from '@/features/smc-lab/persistence/smc-lab-store'
import {
  clearSmcLabLocalStorageForTests,
  listSmcSavedConfigs,
  loadSmcLabPreferences,
  saveSmcNamedConfig,
  updateSmcDetectorPrefs,
} from '@/features/smc-lab/persistence/prefs-archive'
import { buildReviewSummary } from '@/features/smc-lab/review-summary'
import { runSmcDetectionJob } from '@/features/smc-lab/run-detection-job'
import { listResearchSessionsBySavedAt } from '@/research/session-archive'
import { listStrategyMetadata } from '@/strategies'
import { listBacktestDetailIds } from '@/backtests/detail-archive'
import { useResearchStore } from '@/stores/research.store'
import { useBacktestStore } from '@/stores/backtest.store'
import { useAppStore } from '@/stores/app.store'
import { createEmptyDashboard } from '@/core/dashboard'

function candle(i: number, c: number): Candle {
  return {
    time: 1_700_000_000_000 + i * 3_600_000,
    open: c,
    high: c + 0.5,
    low: c - 0.5,
    close: c,
    volume: 1,
  }
}

describe('SMC Lab persistence + reviews', () => {
  beforeEach(async () => {
    clearSmcLabLocalStorageForTests()
    const store = new MemorySmcLabStore()
    setSmcLabStoreForTests(store)
    await store.clear()
  })

  it('persists prefs and named configs separately from research/strategy', () => {
    const config = cloneSmcDetectorConfig()
    config.swing.pivotLeft = 3
    updateSmcDetectorPrefs(config)
    expect(loadSmcLabPreferences().detectorConfig.swing.pivotLeft).toBe(3)

    saveSmcNamedConfig({ name: 'My 3/3', config })
    expect(listSmcSavedConfigs().some((c) => c.name === 'My 3/3')).toBe(true)
  })

  it('stores reviews with fingerprints and config hash distinction', async () => {
    const store = new MemorySmcLabStore()
    setSmcLabStoreForTests(store)
    const configA = cloneSmcDetectorConfig()
    const configB = cloneSmcDetectorConfig()
    configB.swing.pivotLeft = 3
    const fingerprint = buildEventFingerprint({
      eventId: 'sh-5-1',
      kind: 'SWING_HIGH',
      candleIndex: 5,
      timestamp: 1,
      price: 100,
    })
    const reviewA: SmcReviewRecord = {
      id: createReviewId(fingerprint, hashSmcConfig(configA)),
      fingerprint,
      detectorVersion: '1.0.0-phase1',
      configSnapshot: configA,
      configHash: hashSmcConfig(configA),
      verdict: 'correct',
      reasonTags: [],
      note: 'looks good',
      reviewedAt: 10,
      datasetKey: 'binance:BTCUSDT:1h',
    }
    await store.putReview(reviewA)

    const detection = {
      swings: [
        {
          id: 'sh-5-1',
          kind: 'SWING_HIGH' as const,
          candleIndex: 5,
          timestamp: 1,
          price: 100,
          confirmedAtIndex: 10,
          confirmedAtTimestamp: 2,
          leftBars: 5,
          rightBars: 5,
          reason: 'test',
        },
      ],
      bosEvents: [],
      diagnostics: {
        detectorVersion: '1.0.0-phase1',
        candleCount: 20,
        visibleThroughIndex: 19,
        swingCandidatesConsidered: 1,
        confirmedSwings: 1,
        wickOnlyBreakCandidatesIgnored: 0,
        validBosEvents: 0,
        repeatedBreaksIgnored: 0,
        computationDurationMs: 1,
      },
    }

    const summaryA = buildReviewSummary({
      detection,
      reviews: await store.listReviews(),
      activeConfigHash: hashSmcConfig(configA),
    })
    expect(summaryA.overall.correct).toBe(1)
    expect(summaryA.overall.reviewedAccuracy).toBe(1)

    const summaryB = buildReviewSummary({
      detection,
      reviews: await store.listReviews(),
      activeConfigHash: hashSmcConfig(configB),
    })
    expect(summaryB.overall.reviewed).toBe(0)
    expect(summaryB.overall.unreviewed).toBe(1)
  })

  it('scopes annotations by dataset key and supports export/import validation', async () => {
    const store = new MemorySmcLabStore()
    setSmcLabStoreForTests(store)
    const key = buildDatasetKey({
      sourceKind: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '1h',
    })
    const annotation: SmcManualAnnotation = {
      id: 'ann-1',
      kind: 'MANUAL_SWING_HIGH',
      datasetKey: key,
      sourceKind: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      timestamp: 100,
      price: 64_000,
      note: 'expected',
      createdAt: 1,
      updatedAt: 1,
    }
    await store.putAnnotation(annotation)
    expect(await store.listAnnotations(key)).toHaveLength(1)
    expect(
      await store.listAnnotations(
        buildDatasetKey({ sourceKind: 'binance', symbol: 'ETHUSDT', timeframe: '1h' }),
      ),
    ).toHaveLength(0)

    const payload: SmcLabExportPayload = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      detectorVersion: '1.0.0-phase1',
      detectorConfig: DEFAULT_SMC_DETECTOR_CONFIG,
      reviews: [],
      annotations: [annotation],
      dataset: {
        datasetKey: key,
        sourceKind: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        startMs: 1,
        endMs: 2,
        candleCount: 10,
      },
    }
    expect(validateSmcLabExport(payload).annotations).toHaveLength(1)
    expect(() => validateSmcLabExport({ schemaVersion: 99 })).toThrow(/Unsupported/)
  })
})

describe('SMC Lab detection job', () => {
  it('cancels without presenting a partial completed result', async () => {
    const candles = Array.from({ length: 6_000 }, (_, i) => candle(i, 100 + (i % 20)))
    const controller = new AbortController()
    controller.abort()
    const job = await runSmcDetectionJob({
      candles,
      visibleIndex: candles.length - 1,
      config: DEFAULT_SMC_DETECTOR_CONFIG,
      signal: controller.signal,
    })
    expect(job.status).toBe('cancelled')
    expect(job.result).toBeNull()
  })

  it('completes small jobs with a full detection result', async () => {
    const candles = Array.from({ length: 40 }, (_, i) => candle(i, 100 + Math.sin(i) * 5))
    const job = await runSmcDetectionJob({
      candles,
      visibleIndex: candles.length - 1,
      config: DEFAULT_SMC_DETECTOR_CONFIG,
    })
    expect(job.status).toBe('completed')
    expect(job.result).not.toBeNull()
    // Consistency with sync API
    const sync = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    expect(job.result!.swings.map((s) => s.id)).toEqual(sync.swings.map((s) => s.id))
  })
})

describe('SMC Lab isolation safeguards', () => {
  beforeEach(() => {
    useResearchStore.getState().reset()
    useAppStore.setState({ activeStrategyId: null })
    useBacktestStore.setState({
      dashboard: createEmptyDashboard(),
      report: null,
      isRunning: false,
      hasAttemptedSessionHydrate: false,
      autoRestored: false,
      liveSession: null,
    })
  })

  it('core detectSmc does not write ResearchSession, Strategy, or Backtest archives', () => {
    const beforeSessions = listResearchSessionsBySavedAt().length
    const beforeStrategies = listStrategyMetadata().length
    const beforeDetails = listBacktestDetailIds().length
    const beforeActive = useAppStore.getState().activeStrategyId
    const beforeHasBacktest = useBacktestStore.getState().dashboard.hasBacktest
    const beforeResearchStatus = useResearchStore.getState().status

    const candles = Array.from({ length: 60 }, (_, i) => candle(i, 100 + (i % 7)))
    detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)

    expect(listResearchSessionsBySavedAt().length).toBe(beforeSessions)
    expect(listStrategyMetadata().length).toBe(beforeStrategies)
    expect(listBacktestDetailIds().length).toBe(beforeDetails)
    expect(useAppStore.getState().activeStrategyId).toBe(beforeActive)
    expect(useBacktestStore.getState().dashboard.hasBacktest).toBe(beforeHasBacktest)
    expect(useResearchStore.getState().status).toBe(beforeResearchStatus)
  })
})
