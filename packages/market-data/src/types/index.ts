// ─── Market Data Engine Types ─────────────────────────────────────────────────

export type MarketAssetClass = 'forex' | 'metals' | 'crypto' | 'indices' | 'synthetic_indices' | 'commodities'
export type MarketDataSource = 'csv' | 'metatrader' | 'dukascopy' | 'sqlite' | 'tradingview' | 'api' | 'migration'
export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type SessionType = 'asian' | 'london' | 'new_york' | 'overlap' | 'off_hours'
export type TimezoneMode = 'utc' | 'broker' | 'local'

export interface MarketCandle {
  id: string
  symbol: string
  timeframe: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  spread: number
  source: MarketDataSource
  session?: SessionType | null
  createdAt: string
}

export interface RawCandle {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  spread?: number
}

export interface MarketSession {
  id: string
  name: string
  type: SessionType
  startUtc: string
  endUtc: string
  timezone: string
}

export interface ImportJob {
  id: string
  fileName: string | null
  source: MarketDataSource
  symbol: string
  timeframe: string
  status: ImportJobStatus
  rowsImported: number
  rowsRejected: number
  durationMs: number | null
  qualityScore: number | null
  errors: ImportError[]
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface ImportError {
  row: number
  message: string
  raw?: string
}

export interface DataQualityReport {
  id: string
  symbol: string
  timeframe: string
  qualityScore: number
  missingCandles: number
  duplicateCandles: number
  invalidOhlc: number
  negativePrices: number
  timezoneIssues: number
  weekendGaps: number
  report: QualityReportDetails
  importJobId: string | null
  createdAt: string
}

export interface QualityReportDetails {
  totalRows: number
  validRows: number
  rejectedRows: number
  dateRange: { start: string | null; end: string | null }
  issues: QualityIssue[]
}

export interface QualityIssue {
  type: string
  count: number
  description: string
}

export interface ParseDetection {
  delimiter: string
  hasHeader: boolean
  dateFormat: string
  columns: Record<string, number>
  timezone: TimezoneMode
}

export interface ImportProgress {
  jobId: string
  status: ImportJobStatus
  processed: number
  total: number
  percent: number
}

export interface ImportResult {
  job: ImportJob
  quality: DataQualityReport
}

export interface CandleRange {
  symbol: string
  timeframe: string
  start: string
  end: string
  count: number
}

export interface CandleQueryParams {
  symbol: string
  timeframe: string
  start?: string
  end?: string
  limit?: number
  offset?: number
}

export const TIMEFRAME_MINUTES: Record<string, number> = {
  M1: 1, M5: 5, M15: 15, M30: 30,
  H1: 60, H4: 240, D1: 1440, W1: 10080, MN: 43200,
}

export const TIMEFRAME_ALIASES: Record<string, string> = {
  '1m': 'M1', '5m': 'M5', '15m': 'M15', '30m': 'M30',
  '1h': 'H1', '4h': 'H4', '1d': 'D1', '1w': 'W1',
  'm1': 'M1', 'm5': 'M5', 'm15': 'M15', 'm30': 'M30',
  'h1': 'H1', 'h4': 'H4', 'd1': 'D1', 'w1': 'W1',
}
