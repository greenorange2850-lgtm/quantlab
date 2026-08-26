import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { DEFAULT_MA_CROSS_PARAMS } from '@/core/strategy/MovingAverageCrossStrategy'
import { BacktestEngine } from '@/core/backtest/BacktestEngine'
import { MovingAverageCrossStrategy } from '@/core/strategy/MovingAverageCrossStrategy'
import { buildBacktestReport } from '@/core/analytics/report-builder'
import {
  MemoryBacktestReplayStore,
  REPLAY_SCHEMA_VERSION,
  getBacktestReplayStore,
  setBacktestReplayStoreForTests,
  type BacktestReplayBundle,
} from '@/data/replay'
import {
  DatasetLibrary,
  MemoryDatasetStore,
  getDatasetLibrary,
  setDatasetLibraryForTests,
} from '@/data/datasets'
import { buildPersistedDetail } from '@/backtests/restore-dashboard'
import {
  clearBacktestDetailArchive,
  saveBacktestDetail,
} from '@/backtests/detail-archive'
import { persistBacktestReplay } from '../load-replay'
import { candlesOnlyReplayBundle, loadReplayPageSource } from '../load-playbook-replay'
import { parsePlaybookReplaySearch } from '@/features/playbook/replay-markers'
import { buildPlaybookReplayOverlay } from '@/features/playbook/replay-markers'

function makeCandles(count: number, start = Date.parse('2024-03-01T00:00:00.000Z')): Candle[] {
  const candles: Candle[] = []
  let price = 200
  for (let i = 0; i < count; i++) {
    const open = price
    const close = price + ((i % 3) - 1) * 0.5
    candles.push({
      time: start + i * 3_600_000,
      open,
      high: Math.max(open, close) + 0.4,
      low: Math.min(open, close) - 0.4,
      close,
      volume: 12,
    })
    price = close
  }
  return candles
}

function buildReport(symbol: string): BacktestReport {
  return {
    summary: {
      totalTrades: 0,
      winRate: 0,
      netProfit: 0,
      profitFactor: 0,
      expectancy: 0,
      averageWin: 0,
      averageLoss: 0,
      maxDrawdown: 0,
      largestWinner: 0,
      largestLoser: 0,
      finalBalance: 10_000,
    },
    equityCurve: [],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 0,
      averageLoss: 0,
      largestWinner: 0,
      largestLoser: 0,
      profitFactor: 0,
      expectancy: 0,
      averageHoldingTimeMs: 0,
      longPerformance: { trades: 0, netProfit: 0, winRate: 0 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      netProfit: 0,
      grossProfit: 0,
      grossLoss: 0,
      maxDrawdown: 0,
      averageTrade: 0,
      finalBalance: 10_000,
    },
    trades: [],
    config: {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol,
      riskConfig: defaultRiskConfig,
    },
  }
}

function slimReplayBundle(input: {
  id: string
  symbol: string
  timeframe: string
  candles: Candle[]
}): BacktestReplayBundle {
  return {
    metadata: {
      backtestId: input.id,
      symbol: input.symbol,
      timeframe: input.timeframe,
      strategyName: 'Moving Average Cross',
      strategyVersion: 'v1',
      strategyParams: { ...DEFAULT_MA_CROSS_PARAMS },
      initialCapital: 10_000,
      finalEquity: 10_000,
      candleCount: input.candles.length,
      tradeCount: 0,
      eventCount: 0,
      datasetId: null,
      datasetTimeframe: null,
      researchStartMs: input.candles[0]?.time ?? null,
      researchEndMs: input.candles.at(-1)?.time ?? null,
      savedAt: 1_700_000_000_000,
      schemaVersion: REPLAY_SCHEMA_VERSION,
    },
    candles: input.candles,
    trades: [],
    events: [],
    equityCurve: [],
    reportSummary: null,
  }
}

function datasetFile(symbol: string, timeframe: '1h', candles: Candle[]) {
  return {
    fileName: `${symbol}_${timeframe}.csv`,
    fileSize: 100,
    symbol,
    timeframe,
    rowCount: candles.length,
    startDate: candles[0]!.time,
    endDate: candles.at(-1)!.time,
    candles,
    warnings: [] as string[],
    delimiter: ',' as const,
    delimiterLabel: 'Comma',
    columnMapping: {
      timestamp: 'timestamp',
      open: 'open',
      high: 'high',
      low: 'low',
      close: 'close',
      volume: 'volume',
    },
  }
}

describe('playbook replay page loader', () => {
  beforeEach(() => {
    clearBacktestDetailArchive()
    setBacktestReplayStoreForTests(new MemoryBacktestReplayStore())
    setDatasetLibraryForTests(new DatasetLibrary(new MemoryDatasetStore()))
  })

  afterEach(() => {
    clearBacktestDetailArchive()
    setBacktestReplayStoreForTests(null)
    setDatasetLibraryForTests(null)
  })

  it('reuses the existing backtest replay candles instead of loading a second series', async () => {
    const candles = makeCandles(80)
    const strategy = new MovingAverageCrossStrategy({
      fastPeriod: 3,
      slowPeriod: 8,
      rsiPeriod: 3,
    })
    const result = new BacktestEngine().run(candles, strategy, {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol: 'ETHUSDT',
      riskConfig: defaultRiskConfig,
    })
    const report = buildBacktestReport(result)
    await persistBacktestReplay({
      backtestId: 'bt-reuse',
      candles,
      trades: report.trades,
      report,
      strategyName: 'Moving Average Cross',
      strategyVersion: 'v1',
      timeframe: '15m',
      strategyParams: strategy.params,
    })

    const loaded = await loadReplayPageSource(
      parsePlaybookReplaySearch(
        '/backtest-replay?backtest=bt-reuse&playbook=bullish-qml-reversal&setup=40',
      ),
    )
    expect(loaded.available).toBe(true)
    if (!loaded.available) return
    expect(loaded.reusedExistingReplay).toBe(true)
    expect(loaded.bundle.candles).toEqual(candles)
    expect(loaded.bundle.trades).toEqual(report.trades)
    expect(loaded.bundle.reportSummary).not.toBeNull()

    const overlay = buildPlaybookReplayOverlay({
      playbookId: 'bullish-qml-reversal',
      symbol: loaded.bundle.metadata.symbol,
      timeframe: loaded.bundle.metadata.timeframe,
      candles: loaded.bundle.candles,
    })
    for (const marker of overlay.markers) {
      expect(marker.timeMs).toBe(loaded.bundle.candles[marker.candleIndex]!.time)
    }
  })

  it('opens a candles-only replay for a slim archive when Playbook overlay is requested', async () => {
    const candles = makeCandles(36)
    saveBacktestDetail(
      buildPersistedDetail({
        id: 'bt-slim-candles',
        report: buildReport('SOLUSDT'),
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'v1',
          timeframe: '4h',
          candles,
        },
      }),
    )

    const withoutPlaybook = await loadReplayPageSource(
      parsePlaybookReplaySearch('?backtest=bt-slim-candles'),
    )
    expect(withoutPlaybook.available).toBe(false)

    const withPlaybook = await loadReplayPageSource(
      parsePlaybookReplaySearch(
        '?backtest=bt-slim-candles&playbook=bullish-qml-reversal&setup=12',
      ),
    )
    expect(withPlaybook.available).toBe(true)
    if (!withPlaybook.available) return
    expect(withPlaybook.reusedExistingReplay).toBe(false)
    expect(withPlaybook.bundle.candles).toHaveLength(36)
    expect(withPlaybook.bundle.trades).toEqual([])
    expect(withPlaybook.bundle.reportSummary).toBeNull()
  })

  it('loads Dataset Library candles once for a playbook replay URL', async () => {
    const candles = makeCandles(40)
    const imported = await getDatasetLibrary().importDataset({
      name: 'ETH local',
      symbol: 'ETHUSDT',
      marketType: 'crypto',
      files: [datasetFile('ETHUSDT', '1h', candles)],
    })

    const loaded = await loadReplayPageSource(
      parsePlaybookReplaySearch(
        `?dataset=${imported.id}&timeframe=1h&playbook=bullish-qml-reversal&setup=20`,
      ),
    )
    expect(loaded.available).toBe(true)
    if (!loaded.available) return
    expect(loaded.source).toBe('dataset-library')
    expect(loaded.bundle.candles).toEqual(candles)
    expect(loaded.bundle.metadata.symbol).toBe('ETHUSDT')
    expect(loaded.bundle.metadata.timeframe).toBe('1h')
    expect(loaded.bundle.trades).toEqual([])
  })

  it('does not invent P&L on a candles-only playbook bundle', () => {
    const candles = makeCandles(10)
    const bundle = candlesOnlyReplayBundle({
      id: 'ds-1',
      symbol: 'ETHUSDT',
      timeframe: '1h',
      candles,
      datasetId: 'ds-1',
    })
    expect(bundle.reportSummary).toBeNull()
    expect(bundle.trades).toEqual([])
    expect(bundle.equityCurve).toEqual([])
  })

  it('still loads a normal backtest replay when no playbook param is present', async () => {
    const candles = makeCandles(50)
    await getBacktestReplayStore().putBundle(
      slimReplayBundle({ id: 'bt-plain', symbol: 'ETHUSDT', timeframe: '15m', candles }),
    )
    const loaded = await loadReplayPageSource(parsePlaybookReplaySearch('?backtest=bt-plain'))
    expect(loaded.available).toBe(true)
    if (!loaded.available) return
    expect(loaded.reusedExistingReplay).toBe(true)
    expect(loaded.bundle.candles).toEqual(candles)
  })
})
