import type { Candle } from '../candles.js'
import type { CandleInterval } from '../providers/MarketDataProvider.js'

/** Market classification for local historical datasets. */
export type DatasetMarketType =
  | 'gold'
  | 'forex'
  | 'stocks'
  | 'crypto'
  | 'commodities'
  | 'indices'
  | 'other'

/** Origin of candle data — extensible for future providers. */
export type DatasetProviderId =
  | 'local'
  | 'binance'
  | 'dukascopy'
  | 'metatrader'
  | 'tradingview'
  | 'yahoo'
  | 'polygon'
  | 'alphavantage'
  | 'kaggle'
  | (string & {})

export type DatasetStatus = 'ready' | 'importing' | 'error'

export interface DatasetMetadata {
  id: string
  name: string
  symbol: string
  marketType: DatasetMarketType
  provider: DatasetProviderId
  timeframes: CandleInterval[]
  startDate: number
  endDate: number
  /** Total candles across all timeframes. */
  candles: number
  /** Per-timeframe candle counts. */
  candleCounts: Record<string, number>
  fileSize: number
  importedAt: number
  status: DatasetStatus
  errorMessage?: string
}

/** Exportable metadata only — never includes candle series. */
export type DatasetMetadataExport = Omit<DatasetMetadata, 'status' | 'errorMessage'> & {
  exportedAt: number
}

export interface DatasetCandleSlice {
  datasetId: string
  timeframe: CandleInterval
  candles: Candle[]
}

export interface CsvImportFilePreview {
  fileName: string
  fileSize: number
  symbol: string
  timeframe: CandleInterval
  rowCount: number
  startDate: number
  endDate: number
  candles: Candle[]
  warnings: string[]
}

export interface CsvImportPreview {
  files: CsvImportFilePreview[]
  suggestedName: string
  suggestedSymbol: string
  suggestedMarketType: DatasetMarketType
  totalRows: number
  totalFileSize: number
  timeframes: CandleInterval[]
  startDate: number
  endDate: number
}

export interface ImportDatasetInput {
  name: string
  symbol: string
  marketType: DatasetMarketType
  provider?: DatasetProviderId
  files: CsvImportFilePreview[]
}

export const DATASET_MARKET_TYPE_LABELS: Record<DatasetMarketType, string> = {
  gold: 'Gold',
  forex: 'Forex',
  stocks: 'Stocks',
  crypto: 'Crypto',
  commodities: 'Commodities',
  indices: 'Indices',
  other: 'Other',
}

export const DATASET_PROVIDER_LABELS: Record<string, string> = {
  local: 'Local Dataset',
  binance: 'Binance',
  dukascopy: 'Dukascopy',
  metatrader: 'MetaTrader',
  tradingview: 'TradingView',
  yahoo: 'Yahoo Finance',
  polygon: 'Polygon',
  alphavantage: 'Alpha Vantage',
  kaggle: 'Kaggle',
}
