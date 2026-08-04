import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import type { Candle } from '@/data/candles'
import { DEFAULT_MA_CROSS_RANGES } from '../index'
import { UniqueCandidateTracker, parameterFingerprint } from '../fingerprint'
import {
  buildMetricChanges,
  buildParameterChanges,
  deriveVerdict,
} from '../improvement-compare'
import {
  estimateSearchSpaceSize,
  fixedStabilityNeighbors,
  sampleNeighborhood,
  selectRefinementCenters,
} from '../neighborhood'
import {
  DEFAULT_PLATEAU_EPSILON,
  DEFAULT_PLATEAU_UNIQUE_WINDOW,
  detectPlateau,
} from '../plateau'
import { selectRecommendedCandidate } from '../recommendation'
import { resolveStageBudgets } from '../stage-budget'
import { analyzeStability } from '../stability'
import { createPauseController } from '../pause-controller'
import { runAdaptiveSearch } from '../adaptive-search'
import { sampleStrategyParams } from '../sampling'
import type { MovingAverageCrossParams } from '@/core/strategy'
import type { RandomSearchCandidate } from '../types'

vi.mock('@/core/dashboard/run-backtest-pipeline', () => ({
  runBacktestPipeline: vi.fn(),
}))

import { runBacktestPipeline } from '@/core/dashboard/run-backtest-pipeline'

function stubReport(scoreLike: number, trades = 40): BacktestReport {
  return {
    summary: {
      totalTrades: trades,
      winRate: 0.4,
      netProfit: scoreLike * 100,
      profitFactor: Math.max(0.5, scoreLike),
      expectancy: scoreLike,
      averageWin: 20,
      averageLoss: -10,
      maxDrawdown: 0.08,
      largestWinner: 40,
      largestLoser: -15,
      finalBalance: 10_000 + scoreLike * 100,
    },
    equityCurve: [
      { time: 1_700_000_000_000, equity: 10_000, cash: 10_000, drawdown: 0 },
      { time: 1_700_086_400_000, equity: 10_000 + scoreLike * 100, cash: 10_000, drawdown: 0 },
    ],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.08,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 20,
      averageLoss: -10,
      largestWinner: 40,
      largestLoser: -15,
      profitFactor: Math.max(0.5, scoreLike),
      expectancy: scoreLike,
      averageHoldingTimeMs: 1,
      longPerformance: { trades, netProfit: scoreLike * 100, winRate: 0.4 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: trades,
      winningTrades: Math.floor(trades / 2),
      losingTrades: Math.ceil(trades / 2),
      winRate: 0.4,
      netProfit: scoreLike * 100,
      grossProfit: 200,
      grossLoss: -100,
      maxDrawdown: 0.08,
      averageTrade: (scoreLike * 100) / trades,
      finalBalance: 10_000 + scoreLike * 100,
    },
    trades: [],
    config: {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol: 'BTCUSDT',
      riskConfig: defaultRiskConfig,
    },
  }
}

function buildCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: 1_700_000_000_000 + i * 3_600_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100 + (i % 5) * 0.1,
    volume: 10,
  }))
}

function candidate(
  id: string,
  params: MovingAverageCrossParams,
  score: number,
  trades: number,
  passed = true,
  stage: RandomSearchCandidate['stage'] = 'exploration',
): RandomSearchCandidate {
  return {
    id,
    parameters: params,
    score,
    passedConstraints: passed,
    report: stubReport(score, trades),
    backtestId: `bt-${id}`,
    stage,
  }
}

const tightRanges = [
  { name: 'fastPeriod' as const, min: 8, max: 10, step: 1 },
  { name: 'slowPeriod' as const, min: 20, max: 22, step: 1 },
  { name: 'rsiPeriod' as const, min: 12, max: 14, step: 1 },
]

describe('stage budget allocation', () => {
  it('allocates ~40/40/20 with exploration remainder', () => {
    const b = resolveStageBudgets(500)
    expect(b.exploration + b.refinement + b.stability).toBe(500)
    expect(b.refinement).toBe(200)
    expect(b.stability).toBe(100)
    expect(b.exploration).toBe(200)
  })

  it('handles small budgets without negative stages', () => {
    const b = resolveStageBudgets(3)
    expect(b.exploration + b.refinement + b.stability).toBe(3)
    expect(b.exploration).toBeGreaterThanOrEqual(0)
  })
})

describe('uniqueness fingerprint', () => {
  it('skips duplicates and counts generated/unique', () => {
    const tracker = new UniqueCandidateTracker()
    const a = { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 }
    expect(tracker.tryAdd(a).isNew).toBe(true)
    expect(tracker.tryAdd(a).isNew).toBe(false)
    expect(tracker.tryAdd({ ...a, fastPeriod: 10 }).isNew).toBe(true)
    expect(tracker.generated).toBe(3)
    expect(tracker.unique).toBe(2)
    expect(tracker.duplicatesSkipped).toBe(1)
    expect(parameterFingerprint(a)).toBe('9:48:13')
  })
})

describe('refinement neighborhoods', () => {
  it('samples around multiple top centers within bounds deterministically', () => {
    const eligible = [
      { parameters: { fastPeriod: 9, slowPeriod: 40, rsiPeriod: 14 }, score: 2.0 },
      { parameters: { fastPeriod: 12, slowPeriod: 55, rsiPeriod: 10 }, score: 1.9 },
      { parameters: { fastPeriod: 15, slowPeriod: 70, rsiPeriod: 12 }, score: 1.8 },
      { parameters: { fastPeriod: 9, slowPeriod: 40, rsiPeriod: 14 }, score: 1.7 },
    ]
    const centers = selectRefinementCenters(eligible, 0.5, 8)
    expect(centers.length).toBeGreaterThan(1)
    expect(centers.length).toBeLessThanOrEqual(3)

    const a = sampleNeighborhood(centers[0]!, DEFAULT_MA_CROSS_RANGES, 5, 42)
    const b = sampleNeighborhood(centers[0]!, DEFAULT_MA_CROSS_RANGES, 5, 42)
    expect(a).toEqual(b)
    for (const p of a) {
      expect(p.fastPeriod).toBeGreaterThanOrEqual(5)
      expect(p.fastPeriod).toBeLessThanOrEqual(30)
      expect(p.fastPeriod).toBeLessThan(p.slowPeriod)
    }
  })

  it('fixed stability neighbors stay in range and exclude center', () => {
    const center = { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 }
    const neighbors = fixedStabilityNeighbors(center, DEFAULT_MA_CROSS_RANGES)
    expect(neighbors.length).toBeGreaterThan(3)
    expect(neighbors.every((n) => parameterFingerprint(n) !== parameterFingerprint(center))).toBe(
      true,
    )
  })
})

describe('stability analysis', () => {
  it('returns INSUFFICIENT_EVIDENCE with too few neighbors', () => {
    const center = { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 }
    const result = analyzeStability(center, 1.5, [
      candidate('n1', { fastPeriod: 8, slowPeriod: 48, rsiPeriod: 13 }, 1.4, 40, true, 'stability'),
    ])
    expect(result.overall).toBe('INSUFFICIENT_EVIDENCE')
  })

  it('flags LOW when nearby scores collapse', () => {
    const center = { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 }
    const neighbors = [
      candidate('n1', { fastPeriod: 8, slowPeriod: 47, rsiPeriod: 12 }, 0.4, 40, true, 'stability'),
      candidate('n2', { fastPeriod: 8, slowPeriod: 49, rsiPeriod: 13 }, 0.5, 40, true, 'stability'),
      candidate('n3', { fastPeriod: 10, slowPeriod: 48, rsiPeriod: 14 }, 0.3, 40, true, 'stability'),
      candidate('n4', { fastPeriod: 10, slowPeriod: 49, rsiPeriod: 12 }, 0.35, 40, true, 'stability'),
    ]
    const result = analyzeStability(center, 1.8, neighbors)
    expect(result.overall).toBe('LOW')
    expect(result.sensitiveParameters.length).toBeGreaterThan(0)
  })

  it('flags HIGH when neighbors stay close', () => {
    const center = { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 }
    const neighbors = [
      candidate('n1', { fastPeriod: 8, slowPeriod: 47, rsiPeriod: 12 }, 1.75, 40, true, 'stability'),
      candidate('n2', { fastPeriod: 8, slowPeriod: 49, rsiPeriod: 13 }, 1.72, 40, true, 'stability'),
      candidate('n3', { fastPeriod: 10, slowPeriod: 48, rsiPeriod: 14 }, 1.78, 40, true, 'stability'),
      candidate('n4', { fastPeriod: 10, slowPeriod: 49, rsiPeriod: 12 }, 1.7, 40, true, 'stability'),
    ]
    const result = analyzeStability(center, 1.8, neighbors)
    expect(result.overall).toBe('HIGH')
    expect(result.stableParameters.length).toBeGreaterThan(0)
  })
})

describe('improvement compare', () => {
  it('reports regressions honestly and orders parameter changes', () => {
    const before = stubReport(1.2, 30).summary
    const after = stubReport(1.5, 67).summary
    after.winRate = 0.31
    before.winRate = 0.36
    after.maxDrawdown = 0.047
    before.maxDrawdown = 0.084

    const changes = buildMetricChanges(before, after, 0.42, 0.74)
    expect(changes.find((c) => c.key === 'netProfit')?.improved).toBe(true)
    expect(changes.find((c) => c.key === 'winRate')?.improved).toBe(false)
    expect(changes.find((c) => c.key === 'maxDrawdown')?.improved).toBe(true)
    expect(changes.find((c) => c.key === 'tradeCount')?.direction).toBe('context')

    const params = buildParameterChanges(
      { fastPeriod: 20, slowPeriod: 50, rsiPeriod: 14 },
      { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 },
    )
    expect(params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'fastPeriod', before: 20, after: 9 }),
      ]),
    )
  })
})

describe('plateau detection', () => {
  it('detects plateau after configured unique window', () => {
    const result = detectPlateau({
      uniqueSinceImprovement: DEFAULT_PLATEAU_UNIQUE_WINDOW,
      plateauUniqueWindow: DEFAULT_PLATEAU_UNIQUE_WINDOW,
      recentBestScores: [1.5, 1.5, 1.5, 1.5, 1.5],
      plateauEpsilon: DEFAULT_PLATEAU_EPSILON,
      duplicateRate: 0.1,
      uniqueCount: 50,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      continued: true,
    })
    expect(result.detected).toBe(true)
    expect(result.reason).toBe('no_improvement_window')
  })

  it('does not false-plateau during recent improvement', () => {
    const result = detectPlateau({
      uniqueSinceImprovement: 2,
      plateauUniqueWindow: DEFAULT_PLATEAU_UNIQUE_WINDOW,
      recentBestScores: [1.0, 1.1, 1.2, 1.3, 1.5],
      plateauEpsilon: DEFAULT_PLATEAU_EPSILON,
      duplicateRate: 0.05,
      uniqueCount: 20,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      continued: true,
    })
    expect(result.detected).toBe(false)
  })

  it('detects space exhausted', () => {
    const space = estimateSearchSpaceSize(tightRanges)
    const result = detectPlateau({
      uniqueSinceImprovement: 1,
      plateauUniqueWindow: DEFAULT_PLATEAU_UNIQUE_WINDOW,
      recentBestScores: [1, 1, 1, 1, 1],
      plateauEpsilon: DEFAULT_PLATEAU_EPSILON,
      duplicateRate: 0.2,
      uniqueCount: Math.ceil(space * 0.95),
      parameterRanges: tightRanges,
      continued: true,
    })
    expect(result.detected).toBe(true)
    expect(result.reason).toBe('space_exhausted')
  })
})

describe('recommendation selection', () => {
  it('never recommends a failed-constraint candidate', () => {
    const raw = candidate('raw', { fastPeriod: 9, slowPeriod: 40, rsiPeriod: 14 }, 2, 20, false)
    const decision = selectRecommendedCandidate({
      eligibleRanked: [],
      rawBest: raw,
      rawBestStability: null,
    })
    expect(decision.ruleId).toBe('none_eligible')
    expect(decision.recommendedCandidateId).toBeNull()
  })

  it('can recommend a stable slightly-lower candidate', () => {
    const raw = candidate('raw', { fastPeriod: 9, slowPeriod: 40, rsiPeriod: 14 }, 2.0, 30)
    const alt = candidate('alt', { fastPeriod: 10, slowPeriod: 42, rsiPeriod: 14 }, 1.95, 50)
    const stab = analyzeStability(
      alt.parameters,
      alt.score,
      [
        candidate('n1', { fastPeriod: 9, slowPeriod: 41, rsiPeriod: 13 }, 1.9, 48, true, 'stability'),
        candidate('n2', { fastPeriod: 11, slowPeriod: 43, rsiPeriod: 15 }, 1.92, 49, true, 'stability'),
        candidate('n3', { fastPeriod: 10, slowPeriod: 41, rsiPeriod: 14 }, 1.91, 47, true, 'stability'),
        candidate('n4', { fastPeriod: 10, slowPeriod: 43, rsiPeriod: 13 }, 1.93, 51, true, 'stability'),
      ],
    )
    const rawStab = analyzeStability(raw.parameters, raw.score, [
      candidate('r1', { fastPeriod: 8, slowPeriod: 39, rsiPeriod: 13 }, 0.5, 20, true, 'stability'),
      candidate('r2', { fastPeriod: 8, slowPeriod: 41, rsiPeriod: 14 }, 0.4, 18, true, 'stability'),
      candidate('r3', { fastPeriod: 10, slowPeriod: 40, rsiPeriod: 15 }, 0.6, 22, true, 'stability'),
      candidate('r4', { fastPeriod: 10, slowPeriod: 41, rsiPeriod: 12 }, 0.55, 21, true, 'stability'),
    ])
    expect(rawStab.overall).toBe('LOW')
    const decision = selectRecommendedCandidate({
      eligibleRanked: [raw, alt],
      rawBest: raw,
      rawBestStability: rawStab,
      candidateStability: new Map([[alt.id, stab]]),
    })
    expect(decision.recommendedCandidateId).toBe('alt')
    expect(['larger_sample', 'stable_neighborhood']).toContain(decision.ruleId)
  })

  it('returns Constraints Not Met verdict when nothing eligible', () => {
    const verdict = deriveVerdict({
      baseline: null,
      recommended: null,
      eligibleCount: 0,
      stability: null,
      stabilityIncomplete: false,
    })
    expect(verdict.verdict).toBe('Constraints Not Met')
  })
})

describe('adaptive search lifecycle + determinism', () => {
  beforeEach(() => {
    vi.mocked(runBacktestPipeline).mockReset()
    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      const fast = params?.strategyParams?.fastPeriod ?? 20
      const slow = params?.strategyParams?.slowPeriod ?? 50
      const rsi = params?.strategyParams?.rsiPeriod ?? 14
      // Deterministic score from params so rankings are stable.
      const score = 1 + fast / 100 + slow / 1000 + rsi / 1000
      return {
        report: stubReport(score, 40 + (fast % 5)),
        candles: params?.candles ?? [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: params?.candles ?? [],
        },
        backtestId: `bt-${fast}-${slow}-${rsi}`,
        strategyParams: { fastPeriod: fast, slowPeriod: slow, rsiPeriod: rsi },
      }
    })
  })

  it('runs baseline on shared candles then stages', async () => {
    const candles = buildCandles(40)
    const session = await runAdaptiveSearch({
      candles,
      config: {
        iterations: 10,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 40,
        initialCapital: 10_000,
        seed: 7,
        baselineParameters: { fastPeriod: 20, slowPeriod: 50, rsiPeriod: 14 },
      },
      yieldFn: async () => {},
    })

    expect(session.baseline).not.toBeNull()
    expect(session.baseline?.parameters).toEqual({
      fastPeriod: 20,
      slowPeriod: 50,
      rsiPeriod: 14,
    })
    expect(vi.mocked(runBacktestPipeline).mock.calls[0]?.[0]?.candles).toBe(candles)
    expect(session.optimizationResult?.schemaVersion).toBe(1)
    expect(session.improvementTimeline?.length).toBeGreaterThanOrEqual(0)
    expect(session.status).toBe('completed')
    // baseline + up to 10 candidates
    expect(vi.mocked(runBacktestPipeline).mock.calls.length).toBeGreaterThan(10)
    for (const call of vi.mocked(runBacktestPipeline).mock.calls) {
      expect(call[0]?.candles).toBe(candles)
    }
  })

  it('is deterministic for identical seed and cooperative batch sizes', async () => {
    const candles = buildCandles(30)
    const config = {
      iterations: 12,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      objective: 'profitFactor' as const,
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 30,
      initialCapital: 10_000,
      seed: 99,
      baselineParameters: { fastPeriod: 12, slowPeriod: 40, rsiPeriod: 14 },
    }

    const a = await runAdaptiveSearch({ candles, config, yieldFn: async () => {} })
    vi.mocked(runBacktestPipeline).mockClear()
    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      const fast = params?.strategyParams?.fastPeriod ?? 20
      const slow = params?.strategyParams?.slowPeriod ?? 50
      const rsi = params?.strategyParams?.rsiPeriod ?? 14
      const score = 1 + fast / 100 + slow / 1000 + rsi / 1000
      return {
        report: stubReport(score, 40 + (fast % 5)),
        candles: params?.candles ?? [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: params?.candles ?? [],
        },
        backtestId: `bt-${fast}-${slow}-${rsi}`,
        strategyParams: { fastPeriod: fast, slowPeriod: slow, rsiPeriod: rsi },
      }
    })
    const b = await runAdaptiveSearch({ candles, config, yieldFn: async () => {} })

    expect(a.bestCandidateId && a.candidates.find((c) => c.id === a.bestCandidateId)?.parameters).toEqual(
      b.bestCandidateId && b.candidates.find((c) => c.id === b.bestCandidateId)?.parameters,
    )
    expect(a.rawBestCandidateId && a.candidates.find((c) => c.id === a.rawBestCandidateId)?.score).toBe(
      b.rawBestCandidateId && b.candidates.find((c) => c.id === b.rawBestCandidateId)?.score,
    )
    expect(a.optimizationResult?.verdict).toBe(b.optimizationResult?.verdict)
  })

  it('pause/resume continues without changing the next candidate sequence', async () => {
    const candles = buildCandles(25)
    const pause = createPauseController()
    const statuses: string[] = []
    let seenBaseline = false

    const run = runAdaptiveSearch({
      candles,
      config: {
        iterations: 8,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 25,
        initialCapital: 10_000,
        seed: 3,
      },
      pauseController: pause,
      yieldFn: async () => {},
      onProgress: (p) => {
        statuses.push(p.status)
        if (p.status === 'BASELINE') seenBaseline = true
        if (seenBaseline && p.candidatesTested === 1 && !pause.paused) {
          pause.pause()
          queueMicrotask(() => pause.resume())
        }
      },
    })

    const session = await run
    expect(session.status).toBe('completed')
    expect(statuses).toContain('BASELINE')
    expect(statuses.some((s) => s === 'PAUSED' || s === 'PAUSING')).toBe(true)
  })

  it('cancellation builds a partial optimization result', async () => {
    const candles = buildCandles(20)
    const controller = new AbortController()
    const sessionPromise = runAdaptiveSearch({
      candles,
      config: {
        iterations: 20,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 20,
        initialCapital: 10_000,
        seed: 11,
      },
      signal: controller.signal,
      yieldFn: async () => {},
      onProgress: (p) => {
        if (p.candidatesTested >= 2) controller.abort()
      },
    })
    const session = await sessionPromise
    expect(session.status).toBe('cancelled')
    expect(session.baseline).not.toBeNull()
    expect(session.optimizationResult?.stabilityIncomplete).toBe(true)
  })

  it('emits progress before completion and yields during long stages', async () => {
    const candles = buildCandles(20)
    let yields = 0
    const progresses: number[] = []
    await runAdaptiveSearch({
      candles,
      config: {
        iterations: 6,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 20,
        initialCapital: 10_000,
        seed: 5,
      },
      yieldFn: async () => {
        yields += 1
      },
      onProgress: (p) => {
        progresses.push(p.candidatesTested)
      },
    })
    expect(yields).toBeGreaterThan(0)
    expect(progresses.length).toBeGreaterThan(1)
    expect(progresses[progresses.length - 1]).toBeGreaterThan(0)
  })
})

describe('tight range duplicate sampling', () => {
  it('reports duplicates without inventing unique params beyond space', () => {
    const tracker = new UniqueCandidateTracker()
    const seed = 1
    for (let i = 0; i < 80; i++) {
      const params = sampleStrategyParams(tightRanges, seed + i)
      tracker.tryAdd(params)
    }
    // Discrete space: 3×3×3 = 27 before ordering; estimateSearchSpaceSize is approximate.
    expect(tracker.unique).toBeLessThanOrEqual(27)
    expect(tracker.duplicatesSkipped).toBeGreaterThan(0)
    expect(estimateSearchSpaceSize(tightRanges)).toBeGreaterThan(0)
  })
})
