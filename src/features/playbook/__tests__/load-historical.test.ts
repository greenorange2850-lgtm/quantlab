import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { DEFAULT_MA_CROSS_PARAMS } from '@/core/strategy/MovingAverageCrossStrategy'
import { evaluateHistoricalPlaybook } from '@/core/playbook'
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
import {
  listPlaybookHistoricalCatalog,
  loadPlaybookHistoricalSource,
} from '../load-historical'

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

function replayBundle(input: {
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

describe('playbook historical source loader', () => {
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

  it('returns an empty catalog when no saved historical datasets exist', async () => {
    expect(await listPlaybookHistoricalCatalog()).toEqual([])
  })

  it('loads a saved backtest from the replay store with its actual symbol/timeframe/candles', async () => {
    const candles = makeCandles(40)
    await getBacktestReplayStore().putBundle(
      replayBundle({ id: 'bt-eth', symbol: 'ETHUSDT', timeframe: '15m', candles }),
    )

    const catalog = await listPlaybookHistoricalCatalog()
    expect(catalog).toHaveLength(1)
    expect(catalog[0]).toMatchObject({
      kind: 'backtest',
      id: 'bt-eth',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      origin: 'replay-store',
    })

    const loaded = await loadPlaybookHistoricalSource({ kind: 'backtest', id: 'bt-eth' })
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.symbol).toBe('ETHUSDT')
    expect(loaded.timeframe).toBe('15m')
    expect(loaded.candles).toEqual(candles)
    expect(loaded.detectorEventsAvailable).toBe(false)

    const evaluated = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      symbol: loaded.symbol,
      timeframe: loaded.timeframe,
      candles: loaded.candles,
      detectorEvents: loaded.detectorEvents,
    })
    expect(evaluated.ok).toBe(true)
    if (!evaluated.ok) return
    expect(evaluated.meta.symbol).toBe('ETHUSDT')
    expect(evaluated.meta.timeframe).toBe('15m')
    expect(evaluated.meta.candleCount).toBe(40)
  })

  it('loads candles from the detail archive when replay storage has none', async () => {
    const candles = makeCandles(24)
    saveBacktestDetail(
      buildPersistedDetail({
        id: 'bt-detail',
        report: buildReport('SOLUSDT'),
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'v1',
          timeframe: '4h',
          candles,
        },
      }),
    )

    const loaded = await loadPlaybookHistoricalSource({ kind: 'backtest', id: 'bt-detail' })
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.origin).toBe('detail-archive')
    expect(loaded.symbol).toBe('SOLUSDT')
    expect(loaded.timeframe).toBe('4h')
    expect(loaded.candles).toHaveLength(24)
  })

  it('does not invent candles for a slim archive', async () => {
    saveBacktestDetail(
      buildPersistedDetail({
        id: 'bt-slim',
        report: buildReport('BTCUSDT'),
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'v1',
          timeframe: '1h',
        },
      }),
    )
    const loaded = await loadPlaybookHistoricalSource({ kind: 'backtest', id: 'bt-slim' })
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.code).toBe('missing_candles')
  })

  it('loads a Dataset Library series using a recorded timeframe', async () => {
    const candles = makeCandles(30)
    const imported = await getDatasetLibrary().importDataset({
      name: 'ETH local',
      symbol: 'ETHUSDT',
      marketType: 'crypto',
      files: [datasetFile('ETHUSDT', '1h', candles)],
    })

    const loaded = await loadPlaybookHistoricalSource({
      kind: 'dataset',
      id: imported.id,
      timeframe: '1h',
    })
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.symbol).toBe('ETHUSDT')
    expect(loaded.timeframe).toBe('1h')
    expect(loaded.candles).toHaveLength(30)
  })

  it('rejects an unknown dataset timeframe instead of inventing one', async () => {
    const candles = makeCandles(10)
    const imported = await getDatasetLibrary().importDataset({
      name: 'ETH local',
      symbol: 'ETHUSDT',
      marketType: 'crypto',
      files: [datasetFile('ETHUSDT', '1h', candles)],
    })

    const loaded = await loadPlaybookHistoricalSource({
      kind: 'dataset',
      id: imported.id,
      timeframe: '2h',
    })
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.code).toBe('unknown_timeframe')
  })

  it('does not invent a missing backtest symbol', async () => {
    const candles = makeCandles(20)
    await getBacktestReplayStore().putBundle(
      replayBundle({ id: 'bt-nosym', symbol: '   ', timeframe: '1h', candles }),
    )
    const loaded = await loadPlaybookHistoricalSource({ kind: 'backtest', id: 'bt-nosym' })
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.code).toBe('missing_symbol')
  })
})
