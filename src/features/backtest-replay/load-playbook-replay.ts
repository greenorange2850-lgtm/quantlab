// Load the existing Backtest Replay candle source for a Playbook overlay.
// Does not duplicate candle fetching: prefers loadBacktestReplay, then the
// Playbook historical loader for slim archives / Dataset Library series.

import type { Candle } from '@/data/candles'
import {
  REPLAY_SCHEMA_VERSION,
  type BacktestReplayBundle,
} from '@/data/replay'
import { loadPlaybookHistoricalSource } from '@/features/playbook/load-historical'
import {
  replayPageQueryIsValid,
  type PlaybookReplayQuery,
} from '@/features/playbook/replay-markers'
import { loadBacktestReplay } from './load-replay'

export type ReplayPageLoadResult =
  | {
      available: true
      source: 'indexeddb' | 'detail-archive' | 'dataset-library'
      bundle: BacktestReplayBundle
      detectorEvents: unknown
      /** True when the IndexedDB / detail-archive trade replay bundle was reused. */
      reusedExistingReplay: boolean
    }
  | { available: false; reason: string; message: string }

export function candlesOnlyReplayBundle(input: {
  id: string
  symbol: string
  timeframe: string
  candles: Candle[]
  datasetId?: string | null
}): BacktestReplayBundle {
  const first = input.candles[0]?.time ?? null
  const last = input.candles.at(-1)?.time ?? null
  return {
    metadata: {
      backtestId: input.id,
      symbol: input.symbol,
      timeframe: input.timeframe,
      strategyName: 'Playbook Lab',
      strategyVersion: '1.0.0',
      strategyParams: null,
      initialCapital: 0,
      finalEquity: 0,
      candleCount: input.candles.length,
      tradeCount: 0,
      eventCount: 0,
      datasetId: input.datasetId ?? null,
      datasetTimeframe: input.datasetId ? input.timeframe : null,
      researchStartMs: first,
      researchEndMs: last,
      savedAt: Date.now(),
      schemaVersion: REPLAY_SCHEMA_VERSION,
    },
    candles: input.candles,
    trades: [],
    events: [],
    equityCurve: [],
    reportSummary: null,
  }
}

export async function loadReplayPageSource(
  query: PlaybookReplayQuery,
): Promise<ReplayPageLoadResult> {
  if (!replayPageQueryIsValid(query)) {
    return {
      available: false,
      reason: 'invalid_query',
      message:
        'Open replay from a completed backtest, Playbook Lab Historical, or add ?backtest=<id> to the URL.',
    }
  }

  if (query.backtestId) {
    const replay = await loadBacktestReplay(query.backtestId)
    if (replay.available) {
      return {
        available: true,
        source: replay.source,
        bundle: replay.bundle,
        detectorEvents: [],
        reusedExistingReplay: true,
      }
    }

    if (query.playbookId) {
      const historical = await loadPlaybookHistoricalSource({
        kind: 'backtest',
        id: query.backtestId,
      })
      if (historical.ok) {
        return {
          available: true,
          source: historical.origin === 'replay-store' ? 'indexeddb' : 'detail-archive',
          bundle: candlesOnlyReplayBundle({
            id: query.backtestId,
            symbol: historical.symbol,
            timeframe: historical.timeframe,
            candles: historical.candles,
          }),
          detectorEvents: historical.detectorEvents,
          reusedExistingReplay: false,
        }
      }
    }

    return {
      available: false,
      reason: replay.reason,
      message: replay.message,
    }
  }

  const historical = await loadPlaybookHistoricalSource({
    kind: 'dataset',
    id: query.datasetId!,
    timeframe: query.timeframe,
  })
  if (!historical.ok) {
    return {
      available: false,
      reason: historical.code,
      message: historical.message,
    }
  }

  return {
    available: true,
    source: 'dataset-library',
    bundle: candlesOnlyReplayBundle({
      id: query.datasetId!,
      symbol: historical.symbol,
      timeframe: historical.timeframe,
      candles: historical.candles,
      datasetId: query.datasetId,
    }),
    detectorEvents: historical.detectorEvents,
    reusedExistingReplay: false,
  }
}
