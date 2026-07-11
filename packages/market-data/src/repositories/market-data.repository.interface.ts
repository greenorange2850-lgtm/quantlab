import type {
  MarketCandle,
  RawCandle,
  ImportJob,
  DataQualityReport,
  MarketSession,
  MarketDataSource,
  SessionType,
} from '../types/index.js'

export interface InsertCandleInput extends RawCandle {
  session?: SessionType
}

export interface IMarketDataRepository {
  insertCandlesBatch(
    symbol: string,
    timeframe: string,
    source: MarketDataSource,
    candles: InsertCandleInput[],
  ): number

  getCandles(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
    offset?: number
  }): MarketCandle[]

  getLatest(symbol: string, timeframe: string): MarketCandle | null
  getRange(symbol: string, timeframe: string): { start: string | null; end: string | null; count: number }
  getPrevious(symbol: string, timeframe: string, timestamp: string): MarketCandle | null
  getNext(symbol: string, timeframe: string, timestamp: string): MarketCandle | null

  createImportJob(job: Omit<ImportJob, 'errors'> & { errors?: ImportJob['errors'] }): ImportJob
  updateImportJob(id: string, update: Partial<ImportJob>): void
  getImportJob(id: string): ImportJob | null
  listImportJobs(limit?: number): ImportJob[]

  saveQualityReport(report: Omit<DataQualityReport, 'id' | 'createdAt'>): DataQualityReport
  getLatestQuality(symbol: string, timeframe: string): DataQualityReport | null

  getSessions(): MarketSession[]
  getSymbols(): Array<{ id: string; name: string; displayName: string; assetClass: string }>
  getTimeframes(): Array<{ id: string; code: string; minutes: number; label: string }>
}
