import type { Candle } from '@/data/candles'
import type { Trade } from '@/core/backtest/Trade'
import type { BacktestExecutionEvent } from '@/core/backtest/execution-events'
import type { BacktestReport } from '@/core/analytics/types'
import type { MovingAverageCrossParams } from '@/core/strategy/MovingAverageCrossStrategy'
import { DEFAULT_MA_CROSS_PARAMS } from '@/core/strategy/MovingAverageCrossStrategy'
import { getBacktestDetail } from '@/backtests/detail-archive'
import {
  getBacktestReplayStore,
  REPLAY_SCHEMA_VERSION,
  type BacktestReplayBundle,
  type BacktestReplayMetadata,
} from '@/data/replay'

export type ReplayAvailability =
  | { available: true; source: 'indexeddb' | 'detail-archive'; bundle: BacktestReplayBundle }
  | {
      available: false
      reason: 'missing' | 'slim_archive'
      message: string
    }

const SLIM_MESSAGE =
  'Full replay data is unavailable for this archived session.'

const SLIM_HINT =
  'Replay unavailable: this slim archive does not contain full candle and trade data.'

export function replayUnavailableMessage(kind: 'missing' | 'slim_archive'): string {
  return kind === 'slim_archive' ? SLIM_MESSAGE : SLIM_HINT
}

export async function loadBacktestReplay(backtestId: string): Promise<ReplayAvailability> {
  const store = getBacktestReplayStore()
  try {
    const fromIdb = await store.getBundle(backtestId)
    if (fromIdb && fromIdb.candles.length > 0 && fromIdb.trades) {
      return { available: true, source: 'indexeddb', bundle: fromIdb }
    }
  } catch {
    // Fall through to detail archive.
  }

  const detail = getBacktestDetail(backtestId)
  if (!detail) {
    return {
      available: false,
      reason: 'missing',
      message: replayUnavailableMessage('missing'),
    }
  }

  const candles = detail.context.candles ? [...detail.context.candles] : []
  const trades = detail.report.trades ?? []
  if (candles.length === 0 || trades.length === 0) {
    return {
      available: false,
      reason: 'slim_archive',
      message: replayUnavailableMessage('slim_archive'),
    }
  }

  const bundle = buildBundleFromDetail({
    backtestId,
    candles,
    trades,
    report: detail.report,
    strategyName: detail.context.strategyName,
    strategyVersion: detail.context.strategyVersion,
    timeframe: detail.context.timeframe,
    events: [],
    strategyParams: null,
  })

  return { available: true, source: 'detail-archive', bundle }
}

export function canOpenReplayFromDetail(input: {
  candles?: readonly Candle[] | null
  trades?: readonly Trade[] | null
}): boolean {
  return Boolean(input.candles && input.candles.length > 0 && input.trades && input.trades.length > 0)
}

export async function persistBacktestReplay(input: {
  backtestId: string
  candles: Candle[]
  trades: Trade[]
  events?: BacktestExecutionEvent[]
  report: BacktestReport
  strategyName: string
  strategyVersion: string
  timeframe: string
  strategyParams?: MovingAverageCrossParams | null
  datasetId?: string | null
}): Promise<void> {
  if (input.candles.length === 0) return

  const bundle = buildBundleFromDetail({
    backtestId: input.backtestId,
    candles: input.candles,
    trades: input.trades,
    report: input.report,
    strategyName: input.strategyName,
    strategyVersion: input.strategyVersion,
    timeframe: input.timeframe,
    events: input.events ?? [],
    strategyParams: input.strategyParams ?? null,
    datasetId: input.datasetId ?? null,
  })

  try {
    await getBacktestReplayStore().putBundle(bundle)
  } catch {
    // IndexedDB may be unavailable; detail archive remains the fallback.
  }
}

function buildBundleFromDetail(input: {
  backtestId: string
  candles: Candle[]
  trades: Trade[]
  report: BacktestReport
  strategyName: string
  strategyVersion: string
  timeframe: string
  events: BacktestExecutionEvent[]
  strategyParams: MovingAverageCrossParams | null
  datasetId?: string | null
}): BacktestReplayBundle {
  const first = input.candles[0]?.time ?? null
  const last = input.candles.at(-1)?.time ?? null
  const metadata: BacktestReplayMetadata = {
    backtestId: input.backtestId,
    symbol: input.report.config.symbol,
    timeframe: input.timeframe,
    strategyName: input.strategyName,
    strategyVersion: input.strategyVersion,
    strategyParams: input.strategyParams ?? { ...DEFAULT_MA_CROSS_PARAMS },
    initialCapital: input.report.config.initialCapital,
    finalEquity: input.report.summary.finalBalance,
    candleCount: input.candles.length,
    tradeCount: input.trades.length,
    eventCount: input.events.length,
    datasetId: input.datasetId ?? null,
    datasetTimeframe: input.datasetId ? input.timeframe : null,
    researchStartMs: first,
    researchEndMs: last,
    savedAt: Date.now(),
    schemaVersion: REPLAY_SCHEMA_VERSION,
  }

  return {
    metadata,
    candles: input.candles,
    trades: input.trades,
    events: input.events,
    reportSummary: {
      netProfit: input.report.summary.netProfit,
      totalTrades: input.report.summary.totalTrades,
      winRate: input.report.summary.winRate,
      profitFactor: input.report.summary.profitFactor,
      maxDrawdown: input.report.summary.maxDrawdown,
      finalBalance: input.report.summary.finalBalance,
    },
  }
}
