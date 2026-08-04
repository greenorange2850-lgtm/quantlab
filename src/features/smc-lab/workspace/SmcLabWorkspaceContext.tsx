import { createContext, useContext, type ReactNode } from 'react'
import type { Candle } from '@/data/candles'
import type { MarketSourceKind } from '@/data/market-source'
import type { ResearchPeriodSelection } from '@/data/research-period'
import type {
  SmcDetectionResult,
  SmcDetectorConfig,
  SmcDetectionProfile,
  SmcDowTheoryLayer,
  SmcGoldenDataset,
  SmcProfileCompareCounts,
  SmcSetupVisualContext,
  SmcValidationReport,
  SmcVisibilityMode,
  SmcZoneLifecycleSettings,
  SmcZoneProjection,
  SmcEvent,
  SmcRankedEventMeta,
  QmlPattern,
} from '@/core/smc'
import type { SmcChartLayerToggles } from '../components/SmcCandlestickChart'
import type { SmcPlaySpeed } from '../components/SmcCursorControls'
import type { SmcEventFilter } from '../components/SmcEventList'
import type { SmcModuleProgress } from '../run-detection-job'
import type {
  SmcDensityPreset,
  SmcManualAnnotation,
  SmcReviewRecord,
  SmcSavedLabConfig,
  SmcSmartVisibilityPresetPref,
  SmcVisibilityModePref,
  SmcWrongTag,
} from '../persistence/types'
import type {
  SmcLifecycleProjectionResult,
  SmcVisibilityPipelineDiagnostics,
} from '@/core/smc'
import type { DowChartVisibilityResult } from '../dow-visibility'
import type { SwingChartMarkerProjection } from '../dow-label'
import type { buildReviewSummary, SmcReviewSummaryBucket } from '../review-summary'

/** Shared view-model for SMC Lab workspaces — state lives in SmcLabPage. */
export interface SmcLabWorkspaceModel {
  // Market
  sourceKind: MarketSourceKind
  setSourceKind: (v: MarketSourceKind) => void
  datasetId: string | null
  setDatasetId: (v: string | null) => void
  symbol: string
  setSymbol: (v: string) => void
  interval: string
  setInterval: (v: string) => void
  periodSelection: ResearchPeriodSelection
  setPeriodSelection: (v: ResearchPeriodSelection) => void
  periodLabel: string
  candles: Candle[]
  candlesLoading: boolean
  candlesError: string | null
  providerLabel: string
  periodError: string | null

  // Config / view
  config: SmcDetectorConfig
  setConfig: (v: SmcDetectorConfig) => void
  layers: SmcChartLayerToggles
  setLayers: (v: SmcChartLayerToggles | ((prev: SmcChartLayerToggles) => SmcChartLayerToggles)) => void
  densityPreset: SmcDensityPreset
  setDensityPreset: (v: SmcDensityPreset) => void
  visibilityMode: SmcVisibilityModePref
  handleVisibilityMode: (v: SmcVisibilityModePref) => void
  smartVisibilityPreset: SmcSmartVisibilityPresetPref
  handleSmartVisibilityPreset: (v: SmcSmartVisibilityPresetPref) => void
  exitSetupFocus: () => void
  zoneLifecycle: SmcZoneLifecycleSettings
  setZoneLifecycle: (
    v: SmcZoneLifecycleSettings | ((prev: SmcZoneLifecycleSettings) => SmcZoneLifecycleSettings),
  ) => void
  setupContext: SmcSetupVisualContext | null
  activeProfileId: string
  setActiveProfileId: (v: string) => void
  applyProfile: (profile: SmcDetectionProfile) => void
  resetDefaults: () => void
  compareProfileId: string | null
  setCompareProfileId: (v: string | null) => void
  compareCounts: {
    nameA: string
    nameB: string
    a: SmcProfileCompareCounts
    b: SmcProfileCompareCounts
  } | null
  candleDiffText: string | null
  savedConfigName: string
  setSavedConfigName: (v: string) => void
  savedTick: number
  bumpSavedTick: () => void
  loadSavedConfig: (config: SmcSavedLabConfig) => void
  deleteSavedConfig?: (id: string) => void

  // Detection
  detection: SmcDetectionResult
  progressive: SmcDetectionResult
  progressiveVisible: SmcDetectionResult
  detecting: boolean
  detectionProgress: number | null
  moduleProgress: SmcModuleProgress[] | null
  applyDetection: () => void
  clearMarkers: () => void
  configDirty: boolean
  appliedConfigHash: string | null

  // Chart / replay
  windowCandles: Candle[]
  windowStart: number
  chartStructure: {
    swings: SmcDetectionResult['swings']
    classifiedSwings: SmcDetectionResult['classifiedSwings']
    bosEvents: SmcDetectionResult['bosEvents']
    chochEvents: SmcDetectionResult['chochEvents']
    displacementEvents: SmcDetectionResult['displacementEvents']
  }
  highlightSwingId: string | null
  visibleIndex: number
  setVisibleIndex: (v: number | ((prev: number) => number)) => void
  playing: boolean
  setPlaying: (v: boolean) => void
  speed: SmcPlaySpeed
  setSpeed: (v: SmcPlaySpeed) => void
  annotations: SmcManualAnnotation[]
  setAnnotations: (v: SmcManualAnnotation[]) => void
  selectedEventId: string | null
  setSelectedEventId: (v: string | null) => void
  selectedZoneId: string | null
  setSelectedZoneId: (v: string | null) => void
  selectedQmlId: string | null
  selectQmlPattern: (pattern: QmlPattern) => void
  selectedEvent: SmcEvent | null
  selectedZone: SmcZoneProjection | null
  eventFilter: SmcEventFilter
  setEventFilter: (v: SmcEventFilter) => void
  selectEvent: (id: string) => void

  // Dow
  dowTheoryView: SmcDowTheoryLayer
  dowChartVisibility: DowChartVisibilityResult
  chartDowMarkers: SwingChartMarkerProjection[]
  showStructureDowView: () => void
  showDebugDowView: () => void
  lifecycleProjection: SmcLifecycleProjectionResult

  // Reviews / validation
  reviews: SmcReviewRecord[]
  reviewsByEventId: Map<string, SmcReviewRecord>
  selectedReview: SmcReviewRecord | null
  reviewStale: boolean
  note: string
  setNote: (v: string) => void
  tags: SmcWrongTag[]
  setTags: (v: SmcWrongTag[]) => void
  handleVerdict: (verdict: 'correct' | 'wrong' | 'unsure') => void
  handleResetReview: () => void
  summary: ReturnType<typeof buildReviewSummary>
  moduleBuckets: SmcReviewSummaryBucket[]
  goldenDatasets: SmcGoldenDataset[]
  activeGoldenId: string | null
  setActiveGoldenId: (v: string | null) => void
  validationReport: SmcValidationReport | null
  saveGoldenFromCorrectReviews: () => void
  runValidation: () => void
  deleteGoldenDataset: (id: string) => void
  manualKind: SmcManualAnnotation['kind']
  setManualKind: (v: SmcManualAnnotation['kind']) => void
  manualPrice: string
  setManualPrice: (v: string) => void
  manualNote: string
  setManualNote: (v: string) => void
  addManualAnnotation: () => void
  datasetKey: string

  // Diagnostics
  visibilityPipeline: SmcVisibilityPipelineDiagnostics
  invariants: SmcDetectionResult['diagnostics']['invariants']
  detectionComplete: boolean
  exportResearch: () => void
  importResearch: (file: File) => void

  // Shared controls bundle for SmcControlsPanel
  sharedControls: {
    config: SmcDetectorConfig
    layers: SmcChartLayerToggles
    densityPreset: SmcDensityPreset
    activeProfileId: string
    detecting: boolean
    detectionProgress: number | null
    moduleProgress: SmcModuleProgress[] | null
    onChangeConfig: (next: SmcDetectorConfig) => void
    onChangeLayers: (next: SmcChartLayerToggles) => void
    onChangeDensityPreset: (preset: SmcDensityPreset) => void
    onChangeProfileId: (profileId: string) => void
    onApplyProfile: (profile: SmcDetectionProfile) => void
    onResetDefaults: () => void
    onApply: () => void
    onClearMarkers: () => void
    onLoadSavedConfig: (config: SmcSavedLabConfig) => void
    onDeleteSavedConfig?: (id: string) => void
    compareProfileId: string | null
    onCompareProfileId: (id: string | null) => void
  }

  getEventImportance: (eventId: string) => SmcRankedEventMeta | null
  relatedForSelected: { higher: SmcRankedEventMeta[]; nearbyLower: SmcRankedEventMeta[] }
  onSelectRelated: (id: string) => void
  visibilityModeTyped: SmcVisibilityMode
}

const SmcLabWorkspaceContext = createContext<SmcLabWorkspaceModel | null>(null)

export function SmcLabWorkspaceProvider({
  value,
  children,
}: {
  value: SmcLabWorkspaceModel
  children: ReactNode
}) {
  return (
    <SmcLabWorkspaceContext.Provider value={value}>{children}</SmcLabWorkspaceContext.Provider>
  )
}

export function useSmcLabWorkspace(): SmcLabWorkspaceModel {
  const ctx = useContext(SmcLabWorkspaceContext)
  if (!ctx) {
    throw new Error('useSmcLabWorkspace must be used within SmcLabWorkspaceProvider')
  }
  return ctx
}
