// ─── Playbook Lab — Historical Source Loader ──────────────────────────────────
//
// Reuses the existing Backtest Replay store, backtest detail archive, and
// Dataset Library. Does not create a second historical-data system.

import {
  getBacktestDetail,
  listBacktestDetailsBySavedAt,
  type PersistedBacktestDetail,
} from '@/backtests/detail-archive'
import type { Candle } from '@/data/candles'
import { getDatasetLibrary, type DatasetMetadata } from '@/data/datasets'
import {
  getBacktestReplayStore,
  type BacktestReplayMetadata,
} from '@/data/replay'

export type PlaybookHistoricalCatalogKind = 'backtest' | 'dataset'

export interface PlaybookHistoricalCatalogEntry {
  kind: PlaybookHistoricalCatalogKind
  id: string
  label: string
  /** Actual stored symbol — null when the source did not record one. */
  symbol: string | null
  /** Actual stored timeframe for single-TF sources — null when unknown. */
  timeframe: string | null
  /** Actual timeframes recorded on the source (datasets may have several). */
  timeframes: string[]
  candleCount: number | null
  savedAt: number
  origin: 'replay-store' | 'detail-archive' | 'dataset-library'
}

export interface PlaybookHistoricalRef {
  kind: PlaybookHistoricalCatalogKind
  id: string
  /** Required when a dataset records multiple timeframes. */
  timeframe?: string | null
}

export type PlaybookHistoricalLoadFailureCode =
  | 'not_found'
  | 'missing_candles'
  | 'missing_symbol'
  | 'unknown_timeframe'

export interface PlaybookHistoricalLoaded {
  ok: true
  ref: PlaybookHistoricalRef
  origin: PlaybookHistoricalCatalogEntry['origin']
  symbol: string
  timeframe: string
  candles: Candle[]
  /** Detector events from this source — empty when the archive has none. */
  detectorEvents: unknown
  detectorEventsAvailable: boolean
}

export interface PlaybookHistoricalLoadFailure {
  ok: false
  code: PlaybookHistoricalLoadFailureCode
  message: string
}

export type PlaybookHistoricalLoadResult =
  | PlaybookHistoricalLoaded
  | PlaybookHistoricalLoadFailure

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mergeBacktestEntry(
  existing: PlaybookHistoricalCatalogEntry | undefined,
  next: PlaybookHistoricalCatalogEntry,
): PlaybookHistoricalCatalogEntry {
  if (!existing) return next
  // Prefer replay-store origin and fill any metadata the other copy is missing.
  const preferReplay = next.origin === 'replay-store' || existing.origin !== 'replay-store'
  const primary = preferReplay ? next : existing
  const secondary = preferReplay ? existing : next
  return {
    ...primary,
    symbol: primary.symbol ?? secondary.symbol,
    timeframe: primary.timeframe ?? secondary.timeframe,
    timeframes:
      primary.timeframes.length > 0 ? primary.timeframes : secondary.timeframes,
    candleCount: primary.candleCount ?? secondary.candleCount,
    savedAt: Math.max(primary.savedAt, secondary.savedAt),
  }
}

function entryFromReplayMetadata(
  meta: BacktestReplayMetadata,
): PlaybookHistoricalCatalogEntry {
  const symbol = trimOrNull(meta.symbol)
  const timeframe = trimOrNull(meta.timeframe)
  return {
    kind: 'backtest',
    id: meta.backtestId,
    label: [meta.strategyName, symbol, timeframe].filter(Boolean).join(' · ') || meta.backtestId,
    symbol,
    timeframe,
    timeframes: timeframe ? [timeframe] : [],
    candleCount: Number.isFinite(meta.candleCount) ? meta.candleCount : null,
    savedAt: meta.savedAt,
    origin: 'replay-store',
  }
}

function entryFromDetail(detail: PersistedBacktestDetail): PlaybookHistoricalCatalogEntry {
  const symbol = trimOrNull(detail.report.config.symbol) ?? trimOrNull(detail.summary.market)
  const timeframe = trimOrNull(detail.context.timeframe) ?? trimOrNull(detail.summary.timeframe)
  const candleCount = detail.context.candles?.length ?? null
  return {
    kind: 'backtest',
    id: detail.id,
    label:
      [detail.context.strategyName, symbol, timeframe].filter(Boolean).join(' · ') || detail.id,
    symbol,
    timeframe,
    timeframes: timeframe ? [timeframe] : [],
    candleCount,
    savedAt: detail.savedAt,
    origin: 'detail-archive',
  }
}

function entryFromDataset(meta: DatasetMetadata): PlaybookHistoricalCatalogEntry {
  const symbol = trimOrNull(meta.symbol)
  const timeframes = meta.timeframes.filter((tf) => trimOrNull(tf) !== null)
  const timeframe = timeframes.length === 1 ? timeframes[0]! : null
  return {
    kind: 'dataset',
    id: meta.id,
    label: [meta.name, symbol].filter(Boolean).join(' · ') || meta.id,
    symbol,
    timeframe,
    timeframes,
    candleCount: Number.isFinite(meta.candles) ? meta.candles : null,
    savedAt: meta.importedAt,
    origin: 'dataset-library',
  }
}

/** List saved backtests and local historical datasets — no invented rows. */
export async function listPlaybookHistoricalCatalog(): Promise<PlaybookHistoricalCatalogEntry[]> {
  const byBacktestId = new Map<string, PlaybookHistoricalCatalogEntry>()

  try {
    const replayMeta = await getBacktestReplayStore().listMetadata()
    for (const meta of replayMeta) {
      if (!meta.backtestId) continue
      byBacktestId.set(
        meta.backtestId,
        mergeBacktestEntry(byBacktestId.get(meta.backtestId), entryFromReplayMetadata(meta)),
      )
    }
  } catch {
    // IndexedDB may be unavailable; detail archive remains.
  }

  for (const detail of listBacktestDetailsBySavedAt()) {
    byBacktestId.set(detail.id, mergeBacktestEntry(byBacktestId.get(detail.id), entryFromDetail(detail)))
  }

  const datasets = await getDatasetLibrary().list()
  const datasetEntries = datasets
    .filter((d) => d.status === 'ready')
    .map(entryFromDataset)

  return [...byBacktestId.values(), ...datasetEntries].sort((a, b) => b.savedAt - a.savedAt)
}

export async function loadPlaybookHistoricalSource(
  ref: PlaybookHistoricalRef,
): Promise<PlaybookHistoricalLoadResult> {
  if (ref.kind === 'dataset') {
    return loadDatasetSource(ref)
  }
  return loadBacktestSource(ref)
}

async function loadBacktestSource(
  ref: PlaybookHistoricalRef,
): Promise<PlaybookHistoricalLoadResult> {
  let origin: PlaybookHistoricalLoaded['origin'] = 'detail-archive'
  let symbol: string | null = null
  let timeframe: string | null = null
  let candles: Candle[] = []

  try {
    const store = getBacktestReplayStore()
    const [meta, storedCandles] = await Promise.all([
      store.getMetadata(ref.id),
      store.getCandles(ref.id),
    ])
    if (meta) {
      origin = 'replay-store'
      symbol = trimOrNull(meta.symbol)
      timeframe = trimOrNull(meta.timeframe)
    }
    if (storedCandles && storedCandles.length > 0) {
      candles = storedCandles
    }
  } catch {
    // Fall through to the detail archive.
  }

  const detail = getBacktestDetail(ref.id)
  if (detail) {
    symbol = symbol ?? trimOrNull(detail.report.config.symbol) ?? trimOrNull(detail.summary.market)
    timeframe =
      timeframe ?? trimOrNull(detail.context.timeframe) ?? trimOrNull(detail.summary.timeframe)
    if (candles.length === 0 && detail.context.candles && detail.context.candles.length > 0) {
      candles = [...detail.context.candles]
      origin = 'detail-archive'
    }
  }

  if (!detail && candles.length === 0 && symbol === null && timeframe === null) {
    return {
      ok: false,
      code: 'not_found',
      message: `No saved backtest "${ref.id}" was found in replay storage or the detail archive.`,
    }
  }

  if (!symbol) {
    return {
      ok: false,
      code: 'missing_symbol',
      message: 'This saved backtest has no symbol. Missing metadata is not invented.',
    }
  }
  if (!timeframe) {
    return {
      ok: false,
      code: 'unknown_timeframe',
      message: 'This saved backtest has no timeframe. Missing metadata is not invented.',
    }
  }
  if (candles.length === 0) {
    return {
      ok: false,
      code: 'missing_candles',
      message: 'This saved backtest has no candle series. Slim archives cannot be evaluated.',
    }
  }

  return {
    ok: true,
    ref,
    origin,
    symbol,
    timeframe,
    candles,
    detectorEvents: [],
    detectorEventsAvailable: false,
  }
}

async function loadDatasetSource(
  ref: PlaybookHistoricalRef,
): Promise<PlaybookHistoricalLoadResult> {
  const library = getDatasetLibrary()
  const meta = await library.get(ref.id)
  if (!meta) {
    return {
      ok: false,
      code: 'not_found',
      message: `No dataset "${ref.id}" was found in the Dataset Library.`,
    }
  }

  const symbol = trimOrNull(meta.symbol)
  if (!symbol) {
    return {
      ok: false,
      code: 'missing_symbol',
      message: 'This dataset has no symbol. Missing metadata is not invented.',
    }
  }

  const recorded = meta.timeframes.map((tf) => tf.trim()).filter((tf) => tf.length > 0)
  const requested = trimOrNull(ref.timeframe)
  let timeframe: string | null = requested
  if (!timeframe && recorded.length === 1) {
    timeframe = recorded[0]!
  }
  if (!timeframe) {
    return {
      ok: false,
      code: 'unknown_timeframe',
      message:
        recorded.length === 0
          ? 'This dataset has no timeframe. Missing metadata is not invented.'
          : 'Select one of the dataset’s recorded timeframes. A timeframe is not invented.',
    }
  }
  if (recorded.length > 0 && !recorded.includes(timeframe)) {
    return {
      ok: false,
      code: 'unknown_timeframe',
      message: `Timeframe "${timeframe}" is not recorded on this dataset (${recorded.join(', ')}).`,
    }
  }

  const candles = await library.getCandles(ref.id, timeframe)
  if (!candles || candles.length === 0) {
    return {
      ok: false,
      code: 'missing_candles',
      message: `Dataset "${meta.name}" has no candles for timeframe ${timeframe}.`,
    }
  }

  return {
    ok: true,
    ref: { ...ref, timeframe },
    origin: 'dataset-library',
    symbol,
    timeframe,
    candles,
    detectorEvents: [],
    detectorEventsAvailable: false,
  }
}
