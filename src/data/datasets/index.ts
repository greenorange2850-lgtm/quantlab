export type {
  DatasetMarketType,
  DatasetProviderId,
  DatasetStatus,
  DatasetMetadata,
  DatasetMetadataExport,
  DatasetCandleSlice,
  CsvColumnMapping,
  CsvDelimiter,
  CsvImportFilePreview,
  CsvImportPreview,
  ImportDatasetInput,
} from './types.js'

export {
  DATASET_MARKET_TYPE_LABELS,
  DATASET_PROVIDER_LABELS,
} from './types.js'

export {
  CsvValidationError,
  detectDelimiter,
  delimiterLabel,
  detectTimeframeFromFilename,
  detectSymbolFromFilename,
  inferMarketType,
  normalizeHeader,
  parseDelimitedLine,
  parseTimestamp,
  resolveColumnMap,
  parseOhlcvCsv,
  parseCsvFile,
  buildImportPreview,
  validateOhlc,
  KNOWN_TIMEFRAMES,
  type ParseOhlcvCsvOptions,
  type ParseOhlcvCsvResult,
} from './csv.js'

export type { DatasetStore } from './store.js'
export { MemoryDatasetStore } from './store.js'

export {
  IndexedDBDatasetStore,
  getDatasetStore,
  setDatasetStoreForTests,
  DATASET_DB,
} from './indexeddb-store.js'

export {
  LocalDatasetProvider,
  LOCAL_DATASET_MAX_CANDLES,
  type LocalDatasetProviderOptions,
} from './LocalDatasetProvider.js'

export {
  DatasetLibrary,
  getDatasetLibrary,
  setDatasetLibraryForTests,
  generateDatasetMetadata,
  formatFileSize,
  formatCoverageDate,
} from './library.js'
