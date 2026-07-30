/**
 * Calendar research-period helpers — presentation + window resolution only.
 * Does not change strategy, scoring, or execution semantics.
 */

export type ResearchPeriodPreset = 'last_30d' | 'last_90d' | 'last_1y' | 'custom'

export interface ResearchPeriodSelection {
  preset: ResearchPeriodPreset
  /** Inclusive start (ms). Required for custom; ignored for relative presets at resolve-time. */
  customStartMs?: number
  /** Inclusive end (ms). Required for custom; ignored for relative presets at resolve-time. */
  customEndMs?: number
}

export interface ResolvedResearchPeriod {
  preset: ResearchPeriodPreset
  startMs: number
  endMs: number
  label: string
}

/** Per-request Binance klines page size (API max). */
export const BINANCE_KLINES_PAGE_LIMIT = 1000

/**
 * Hard ceiling on total candles for one research window.
 * Exceeding this throws — never silently truncate the requested period.
 */
export const RESEARCH_PERIOD_MAX_CANDLES = 20_000

/** Default calendar window for Strategy Lab / Optimizer. */
export const DEFAULT_RESEARCH_PERIOD_PRESET: ResearchPeriodPreset = 'last_30d'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
}

const DAY_MS = 86_400_000

export const RESEARCH_PERIOD_PRESET_OPTIONS: {
  id: ResearchPeriodPreset
  label: string
}[] = [
  { id: 'last_30d', label: 'Last 30 days' },
  { id: 'last_90d', label: 'Last 90 days' },
  { id: 'last_1y', label: 'Last 1 year' },
  { id: 'custom', label: 'Custom range' },
]

export function intervalToMs(interval: string): number {
  return INTERVAL_MS[interval] ?? 3_600_000
}

export function resolveResearchPeriod(
  selection: ResearchPeriodSelection,
  nowMs: number = Date.now(),
): ResolvedResearchPeriod {
  if (selection.preset === 'custom') {
    const startMs = selection.customStartMs
    const endMs = selection.customEndMs
    if (
      startMs === undefined ||
      endMs === undefined ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs)
    ) {
      throw new Error('Custom research period requires valid start and end dates')
    }
    if (endMs < startMs) {
      throw new Error('Custom research period end must be on or after start')
    }
    return {
      preset: 'custom',
      startMs,
      endMs,
      label: formatPeriodLabel(startMs, endMs),
    }
  }

  const endMs = nowMs
  const days =
    selection.preset === 'last_30d' ? 30 : selection.preset === 'last_90d' ? 90 : 365
  const startMs = endMs - days * DAY_MS
  const label =
    selection.preset === 'last_30d'
      ? 'Last 30 days'
      : selection.preset === 'last_90d'
        ? 'Last 90 days'
        : 'Last 1 year'

  return { preset: selection.preset, startMs, endMs, label }
}

export function estimateCandleCount(
  startMs: number,
  endMs: number,
  interval: string,
): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0
  const step = intervalToMs(interval)
  return Math.max(0, Math.floor((endMs - startMs) / step) + 1)
}

export function formatPeriodSpan(startMs: number, endMs: number): string {
  const days = (endMs - startMs) / DAY_MS
  if (days < 1.5) {
    const hours = (endMs - startMs) / 3_600_000
    return `~${hours.toFixed(1)} hours`
  }
  if (days < 60) return `~${days.toFixed(1)} days`
  if (days < 400) return `~${(days / 30).toFixed(1)} months`
  return `~${(days / 365).toFixed(2)} years`
}

export function formatPeriodLabel(startMs: number, endMs: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  return `${fmt(startMs)} → ${fmt(endMs)}`
}

/**
 * Sample-size message for research analysis — uses existing trade count + candle window.
 * Does not change rating formulas.
 */
export function formatSampleSizeMessage(input: {
  totalTrades: number
  candleCount: number
  interval: string
  startMs?: number | null
  endMs?: number | null
}): string {
  const { totalTrades, candleCount, interval } = input
  let coverage: string
  if (
    input.startMs != null &&
    input.endMs != null &&
    Number.isFinite(input.startMs) &&
    Number.isFinite(input.endMs) &&
    input.endMs >= input.startMs
  ) {
    coverage = formatPeriodSpan(input.startMs, input.endMs)
  } else {
    const approxMs = Math.max(0, candleCount - 1) * intervalToMs(interval)
    coverage = formatPeriodSpan(0, approxMs)
  }

  return `${totalTrades} trades from ${candleCount} × ${interval} candles (${coverage}). Extend the research period for stronger evidence.`
}

/** Convert HTML date input (yyyy-mm-dd) to UTC start-of-day ms. */
export function dateInputToStartMs(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const ms = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(ms) ? ms : undefined
}

/** Convert HTML date input (yyyy-mm-dd) to UTC end-of-day ms. */
export function dateInputToEndMs(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const ms = Date.parse(`${value}T23:59:59.999Z`)
  return Number.isFinite(ms) ? ms : undefined
}

export function msToDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Merge candle pages chronologically and drop duplicate open times.
 */
export function mergeCandlePages<T extends { time: number }>(pages: T[][]): T[] {
  const byTime = new Map<number, T>()
  for (const page of pages) {
    for (const candle of page) {
      byTime.set(candle.time, candle)
    }
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time)
}

/**
 * Clip candles to an inclusive [startMs, endMs] window.
 */
export function clipCandlesToRange<T extends { time: number }>(
  candles: T[],
  startMs: number,
  endMs: number,
): T[] {
  return candles.filter((candle) => candle.time >= startMs && candle.time <= endMs)
}
