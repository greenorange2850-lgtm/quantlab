/**
 * Temporary development diagnostics for research-period / candle-loading mismatches.
 * Enable with ?periodDiag=1 or in Vite DEV. Does not change strategy or fetch behavior.
 */

import type { ResearchPeriodPreset } from '@/data/research-period'

export interface PeriodFetchSnapshot {
  at: number
  source: 'binance-provider'
  symbol: string
  interval: string
  /** Values received by BinanceProvider.getCandles */
  received: {
    limit: number
    startTime: number | null
    endTime: number | null
    hasRange: boolean
  }
  paginationRequests: number
  candleCountBeforeClip: number
  candleCountAfterClip: number
  datasetStartMs: number | null
  datasetEndMs: number | null
  mode: 'calendar-range' | 'limit-only'
}

export interface PeriodUiSnapshot {
  at: number
  preset: ResearchPeriodPreset | null
  resolvedStartMs: number | null
  resolvedEndMs: number | null
  queryKey: unknown[] | null
  loadedCandleCount: number | null
  datasetStartMs: number | null
  datasetEndMs: number | null
  sessionId: string | null
  displayedSessionId: string | null
  configStartMs: number | null
  configEndMs: number | null
  configLimit: number | null
  analysisTradeCount: number | null
  analysisPeriodLabel: string | null
}

let lastFetch: PeriodFetchSnapshot | null = null
let lastUi: PeriodUiSnapshot | null = null

export function recordPeriodFetchSnapshot(snapshot: PeriodFetchSnapshot): void {
  lastFetch = snapshot
  if (typeof console !== 'undefined') {
    console.info('[quantlab:period-diag:fetch]', snapshot)
  }
}

export function recordPeriodUiSnapshot(snapshot: PeriodUiSnapshot): void {
  lastUi = snapshot
  if (typeof console !== 'undefined') {
    console.info('[quantlab:period-diag:ui]', snapshot)
  }
}

export function getPeriodFetchSnapshot(): PeriodFetchSnapshot | null {
  return lastFetch
}

export function getPeriodUiSnapshot(): PeriodUiSnapshot | null {
  return lastUi
}

export function shouldShowPeriodDiagnostics(input: {
  isDev: boolean
  search: string
}): boolean {
  if (input.isDev) return true
  return /(?:\?|&)periodDiag=1(?:&|$)/.test(input.search)
}

/** Fingerprint: ~1000 × 15m ≈ 10.4 days (legacy limit-only window). */
export function spansLookLikeLimitOnly1000x15m(
  startMs: number,
  endMs: number,
): boolean {
  const days = (endMs - startMs) / 86_400_000
  return days >= 9.5 && days <= 11.0
}
