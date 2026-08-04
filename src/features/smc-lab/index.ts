export { SmcLabPage } from './SmcLabPage'
export {
  buildReviewSummary,
  flattenDetectionEvents,
  formatReviewedAccuracy,
  moduleForKind,
} from './review-summary'
export {
  getSmcEventDisplayValue,
  isArtificialZeroDisplay,
} from './event-display'
export {
  listReviewableEvents,
  listLifecycleEvents,
  buildEventCountBreakdown,
} from './event-counts'
export { runSmcDetectionJob } from './run-detection-job'
export type { SmcModuleProgress, SmcDetectionJobResult } from './run-detection-job'
export {
  getSmcLabStore,
  setSmcLabStoreForTests,
  MemorySmcLabStore,
  validateSmcLabExport,
} from './persistence/smc-lab-store'
export {
  loadSmcLabPreferences,
  saveSmcLabPreferences,
  listSmcSavedConfigs,
  clearSmcLabLocalStorageForTests,
  layersForDensityPreset,
  DEFAULT_SMC_LAYER_TOGGLES,
  saveSmcNamedConfig,
  deleteSmcNamedConfig,
  renameSmcNamedConfig,
  updateSmcDetectorPrefs,
} from './persistence/prefs-archive'
export type {
  SmcReviewRecord,
  SmcManualAnnotation,
  SmcLabExportPayload,
  SmcLabPreferences,
  SmcDensityPreset,
  SmcSavedLabConfig,
} from './persistence/types'
export type { SmcChartLayerToggles } from './components/SmcCandlestickChart'
export type { SmcEventFilter } from './components/SmcEventList'
