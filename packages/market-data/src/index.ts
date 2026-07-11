import type { IMarketDataRepository } from './repositories/market-data.repository.interface.js'
import { ImportService } from './services/import.service.js'
import { QueryService } from './services/query.service.js'

export class MarketDataEngine {
  readonly import: ImportService
  readonly query: QueryService

  constructor(repo: IMarketDataRepository) {
    this.import = new ImportService(repo)
    this.query = new QueryService(repo)
  }
}

export function createMarketDataEngine(repo: IMarketDataRepository): MarketDataEngine {
  return new MarketDataEngine(repo)
}

// Types
export type * from './types/index.js'
export type { IMarketDataRepository, InsertCandleInput } from './repositories/market-data.repository.interface.js'

// Services
export { ImportService } from './services/import.service.js'
export { QueryService } from './services/query.service.js'

// Parsers
export { parseCsv } from './parsers/csv.parser.js'
export { parseMetaTrader } from './parsers/metatrader.parser.js'
export { parseDukascopy } from './parsers/dukascopy.parser.js'
export { detectFormat, detectDelimiter } from './parsers/detector.js'

// Validators
export { validateCandles, validateCandle } from './validators/candle.validator.js'
export { validateDataset, calculateQualityScore } from './validators/dataset.validator.js'

// Normalizers
export { normalizeCandles } from './normalizers/index.js'
export { normalizeSymbol, normalizeTimeframe, normalizeTimestamp } from './normalizers/candle.normalizer.js'

// Engines
export { classifySession, getSessionWindows } from './engines/session.engine.js'
export { convertTimezone, convertTimestamps } from './engines/timezone.engine.js'

// Cache
export { LRUCache } from './cache/lru-cache.js'

// Utils
export { logger } from './utils/logger.js'
