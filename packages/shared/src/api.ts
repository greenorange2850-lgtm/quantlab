import type {
  AiAnalysis,
  Backtest,
  BacktestSummary,
  CandleStats,
  DashboardData,
  KnowledgeEntry,
  OptimizationRun,
  Report,
  Strategy,
  StrategyVersion,
  Symbol,
  Trade,
  Timeframe,
  Candle,
} from './types.js'

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: ApiMeta
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface ApiMeta {
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type GetDashboardResponse = ApiResponse<DashboardData>

// ─── Strategies ───────────────────────────────────────────────────────────────

export type GetStrategiesResponse = ApiResponse<Strategy[]>
export type GetStrategyResponse = ApiResponse<Strategy>
export type GetStrategyVersionsResponse = ApiResponse<StrategyVersion[]>
export type GetStrategyVersionResponse = ApiResponse<StrategyVersion>

export interface CreateStrategyRequest {
  name: string
  description: string
  tags?: string[]
}

export interface CreateStrategyVersionRequest {
  strategyId: string
  rules: StrategyVersion['rules']
  filters: StrategyVersion['filters']
  changelog: string
  parentVersionId?: string
}

// ─── Backtests ────────────────────────────────────────────────────────────────

export type GetBacktestsResponse = ApiResponse<BacktestSummary[]>
export type GetBacktestResponse = ApiResponse<Backtest>
export type GetBacktestTradesResponse = ApiResponse<Trade[]>

export interface RunBacktestRequest {
  strategyVersionId: string
  symbolId: string
  timeframeId: string
  startDate: string
  endDate: string
  initialCapital?: number
}

export interface CompareBacktestsRequest {
  backtestIds: string[]
}

// ─── Market Data ──────────────────────────────────────────────────────────────

export type GetSymbolsResponse = ApiResponse<Symbol[]>
export type GetTimeframesResponse = ApiResponse<Timeframe[]>
export type GetCandlesResponse = ApiResponse<Candle[]>
export type GetCandleStatsResponse = ApiResponse<CandleStats>

export interface ImportMarketDataRequest {
  source: 'csv' | 'sqlite' | 'metatrader' | 'dukascopy'
  symbolId: string
  timeframeId: string
}

export interface ImportMarketDataResult {
  imported: number
  skipped: number
  total: number
  source: string
  symbolId: string
  timeframeId: string
  format: string
  dateRange: { start: string | null; end: string | null }
}

export type ImportMarketDataResponse = ApiResponse<ImportMarketDataResult>

// ─── AI Analysis ──────────────────────────────────────────────────────────────

export type GetAiAnalysesResponse = ApiResponse<AiAnalysis[]>
export type GetAiAnalysisResponse = ApiResponse<AiAnalysis>

export interface RunAiAnalysisRequest {
  strategyVersionId: string
  backtestId?: string
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export type GetKnowledgeResponse = ApiResponse<KnowledgeEntry[]>

// ─── Optimization ─────────────────────────────────────────────────────────────

export type GetOptimizationRunsResponse = ApiResponse<OptimizationRun[]>

export interface RunOptimizationRequest {
  strategyVersionId: string
  parameters: OptimizationRun['parameters']
  symbolId: string
  timeframeId: string
  startDate: string
  endDate: string
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export type GetReportsResponse = ApiResponse<Report[]>

export interface GenerateReportRequest {
  type: Report['type']
  strategyVersionId?: string
  backtestId?: string
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type GetSettingsResponse = ApiResponse<Record<string, unknown>>

// ─── Health ───────────────────────────────────────────────────────────────────

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down'
  version: string
  engines: Record<string, EngineHealth>
  database: { connected: boolean; path: string }
}

export interface EngineHealth {
  name: string
  status: 'idle' | 'running' | 'error'
  lastRun: string | null
}
