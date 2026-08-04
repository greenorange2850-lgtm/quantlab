import type { PersistedResearchSession } from '@/research/session-archive'
import { buildResearchReport } from '@/core/research'

export const DEFAULT_RESEARCH_STRATEGY_NAME = 'Moving Average Cross'

export type SessionSortOption = 'newest' | 'profit' | 'score'

export interface SessionListFilters {
  search: string
  market: string
  timeframe: string
  sort: SessionSortOption
}

export interface SessionListItem {
  id: string
  strategyName: string
  market: string
  timeframe: string
  researchDate: number
  bestScore: number | null
  netProfit: number | null
  roiPercent: number | null
  maxDrawdown: number | null
  totalTrades: number | null
  status: string
  savedAt: number
  /** Best candidate backtest id when full detail may be available for replay. */
  bestBacktestId: string | null
}

/** Map archived session → list row using existing report fields only. */
export function toSessionListItem(entry: PersistedResearchSession): SessionListItem {
  // Rebuild ensures older archives without analysis still expose bestCandidate metrics.
  const report = buildResearchReport(entry.session)
  const best = report.bestCandidate
  const capital = report.config.initialCapital
  const netProfit = best?.report.summary.netProfit ?? null
  const maxDrawdown = best?.report.summary.maxDrawdown ?? null
  const roiPercent =
    netProfit === null || capital <= 0 ? null : (netProfit / capital) * 100

  return {
    id: entry.session.id,
    strategyName: DEFAULT_RESEARCH_STRATEGY_NAME,
    market: report.config.symbol,
    timeframe: report.config.interval.toUpperCase(),
    researchDate: entry.session.createdAt || entry.savedAt,
    bestScore: best?.score ?? entry.session.progress.bestScore,
    netProfit,
    roiPercent,
    maxDrawdown,
    totalTrades: best?.report.summary.totalTrades ?? null,
    status: report.status,
    savedAt: entry.savedAt,
    bestBacktestId: best?.backtestId ?? null,
  }
}

export function collectFilterOptions(items: SessionListItem[]): {
  markets: string[]
  timeframes: string[]
} {
  const markets = [...new Set(items.map((item) => item.market))].sort()
  const timeframes = [...new Set(items.map((item) => item.timeframe))].sort()
  return { markets, timeframes }
}

/** Client-side filter/sort — no analytics recalculation. */
export function filterAndSortSessions(
  items: SessionListItem[],
  filters: SessionListFilters,
): SessionListItem[] {
  const search = filters.search.trim().toLowerCase()

  const filtered = items.filter((item) => {
    if (search) {
      const haystack = [
        item.strategyName,
        item.market,
        item.timeframe,
        item.id,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    if (filters.market && item.market !== filters.market) return false
    if (filters.timeframe && item.timeframe !== filters.timeframe) return false
    return true
  })

  const sorted = [...filtered]
  switch (filters.sort) {
    case 'profit':
      sorted.sort((a, b) => (b.netProfit ?? Number.NEGATIVE_INFINITY) - (a.netProfit ?? Number.NEGATIVE_INFINITY))
      break
    case 'score':
      sorted.sort((a, b) => (b.bestScore ?? Number.NEGATIVE_INFINITY) - (a.bestScore ?? Number.NEGATIVE_INFINITY))
      break
    case 'newest':
    default:
      sorted.sort((a, b) => b.researchDate - a.researchDate)
      break
  }

  return sorted
}

export const defaultSessionFilters: SessionListFilters = {
  search: '',
  market: '',
  timeframe: '',
  sort: 'newest',
}
