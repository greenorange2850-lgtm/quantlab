import type { MovingAverageCrossParams } from '@/core/strategy'
import type {
  OptimizationResultSummary,
  ResearchReport,
  ResearchSession,
} from '@/core/research'

/** User-facing lifecycle — research sessions stay an implementation detail. */
export type StrategyLifecycle = 'draft' | 'saved' | 'partial'

export type StrategyTabId =
  | 'overview'
  | 'optimization'
  | 'parameters'
  | 'replay'
  | 'equity'
  | 'ai'
  | 'versions'

export const STRATEGY_TABS: ReadonlyArray<{ id: StrategyTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'optimization', label: 'Optimization Summary' },
  { id: 'parameters', label: 'Winning Parameters' },
  { id: 'replay', label: 'Trade Replay' },
  { id: 'equity', label: 'Equity Curve' },
  { id: 'ai', label: 'AI Analysis' },
  { id: 'versions', label: 'Version History' },
] as const

/**
 * Thin overlay on top of a persisted research session.
 * Strategy id === sourceSessionId so existing archives remain the source of truth.
 */
export interface StrategyMetadata {
  id: string
  /** Always equals id — documents the internal session link without exposing it in UI. */
  sourceSessionId: string
  name: string
  description: string
  /** Explicit Save Strategy promotion. Legacy sessions without metadata are treated as saved. */
  saved: boolean
  createdAt: number
  updatedAt: number
  savedAt: number | null
}

export interface StrategyVersionEntry {
  id: string
  label: string
  versionNumber: number
  parameters: MovingAverageCrossParams
  score: number | null
  changelog: string
  createdAt: number
  isCurrent: boolean
  isBaseline: boolean
}

export interface StrategyViewModel {
  id: string
  name: string
  description: string
  lifecycle: StrategyLifecycle
  market: string
  timeframe: string
  createdAt: number
  updatedAt: number
  savedAt: number | null
  bestScore: number | null
  netProfit: number | null
  roiPercent: number | null
  maxDrawdown: number | null
  totalTrades: number | null
  winningParameters: MovingAverageCrossParams | null
  bestBacktestId: string | null
  versions: StrategyVersionEntry[]
  /** Internal — do not surface as “Research Session” in product copy. */
  report: ResearchReport
  session: ResearchSession
  optimization: OptimizationResultSummary | null
  metadata: StrategyMetadata
}

export interface StrategyListItem {
  id: string
  name: string
  market: string
  timeframe: string
  lifecycle: StrategyLifecycle
  createdAt: number
  updatedAt: number
  bestScore: number | null
  netProfit: number | null
  roiPercent: number | null
  maxDrawdown: number | null
  totalTrades: number | null
  bestBacktestId: string | null
}

export type StrategySortOption = 'newest' | 'profit' | 'score'

export interface StrategyListFilters {
  search: string
  market: string
  timeframe: string
  sort: StrategySortOption
  /** When true, only explicitly saved strategies (plus legacy migrated ones). */
  savedOnly: boolean
}

export const DEFAULT_STRATEGY_BASE_NAME = 'Moving Average Cross'

export const defaultStrategyFilters: StrategyListFilters = {
  search: '',
  market: '',
  timeframe: '',
  sort: 'newest',
  savedOnly: true,
}
