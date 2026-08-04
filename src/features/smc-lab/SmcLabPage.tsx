import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  cloneSmcDetectorConfig,
  countProfileEvents,
  createGoldenDatasetId,
  analyzeDowTheory,
  createMockSetupVisualContext,
  DEFAULT_SMC_DETECTOR_CONFIG,
  describeCandleEventDifference,
  emptySmcDetectionResult,
  evaluateSmcValidation,
  eventsAtCandle,
  filterDetectionByRanking,
  getBuiltinSmcProfile,
  getEventImportance,
  goldenLabelFromProbe,
  projectSmcLifecycle,
  QUANTLAB_DEFAULT_PROFILE,
  relatedEventsByRank,
  SMC_DETECTOR_VERSION,
  toDetectedProbes,
  validateSmcDetectorConfig,
  validationModuleForKind,
  withSmcVisibilityMode,
  type QmlPattern,
  type SmcDetectionProfile,
  type SmcDetectionResult,
  type SmcDetectorConfig,
  type SmcEvent,
  type SmcGoldenDataset,
  type SmcProfileCompareCounts,
  type SmcSetupVisualContext,
  type SmcSmartVisibilityPreset,
  type SmcValidationReport,
  type SmcVisibilityMode,
  type SmcZoneLifecycleSettings,
  type SmcZoneProjection,
} from '@/core/smc'
import { createQmlSetupVisualContext } from './qml'
import { createSetupEngineVisualContext } from './setup'
import {
  computeSetupValidationMetrics,
  createSetupReview,
  evaluateSetups,
  upsertSetupReview,
  type SetupEngineResult,
  type SetupReviewRecord,
  type SetupReviewVerdict,
  type TradingSetup,
} from '@/core/setup'
import { DEFAULT_MARKET_SOURCE, type MarketSourceKind } from '@/data/market-source'
import {
  RESEARCH_PERIOD_PRESET_OPTIONS,
  resolveResearchPeriod,
  type ResearchPeriodSelection,
} from '@/data/research-period'
import { useResearchCandles } from '@/api/queries/research-candles'
import { defaultResearchPeriodSelection } from '@/components/market/ResearchPeriodSelect'
import { type SmcChartLayerToggles } from './components/SmcCandlestickChart'
import { type SmcPlaySpeed } from './components/SmcCursorControls'
import { type SmcEventFilter } from './components/SmcEventList'
import {
  layersForDensityPreset,
  loadSmcLabPreferences,
  saveSmcLabPreferences,
  updateSmcDetectorPrefs,
} from './persistence/prefs-archive'
import {
  getSmcLabStore,
  validateSmcLabExport,
} from './persistence/smc-lab-store'
import {
  buildDatasetKey,
  buildEventFingerprint,
  createReviewId,
  hashSmcConfig,
  type SmcDensityPreset,
  type SmcLabExportPayload,
  type SmcManualAnnotation,
  type SmcReviewRecord,
  type SmcSavedLabConfig,
  type SmcSmartVisibilityPresetPref,
  type SmcVisibilityModePref,
  type SmcWrongTag,
} from './persistence/types'
import {
  buildReviewSummary,
  flattenDetectionEvents,
} from './review-summary'
import {
  runSmcDetectionJob,
  type SmcModuleProgress,
} from './run-detection-job'
import { buildLabVisibilityPipelineDiagnostics } from './visibility-pipeline'
import { projectSwingChartMarkers } from './dow-label'
import {
  mergeDowProtectedSwings,
  projectDowChartVisibility,
} from './dow-visibility'
import {
  SmcLabWorkspaceTabs,
  SmcLabWorkspaceProvider,
  SmcAnalyzeWorkspace,
  SmcConfigureWorkspace,
  SmcValidateWorkspace,
  SmcDiagnosticsWorkspace,
  useSmcLabTab,
  hasUnappliedDetectionConfig,
  type SmcLabWorkspaceModel,
} from './workspace'

const CHART_WINDOW = 72
const FOCUS_PAD = 16

function emptyDetection(): SmcDetectionResult {
  return emptySmcDetectionResult('IDLE')
}

function progressiveFilter(
  detection: SmcDetectionResult,
  visibleIndex: number,
): SmcDetectionResult {
  const byIndex = <T extends { candleIndex: number; confirmedAtIndex?: number }>(
    events: T[],
  ): T[] =>
    events.filter((e) => {
      if (typeof e.confirmedAtIndex === 'number') {
        return e.confirmedAtIndex <= visibleIndex
      }
      return e.candleIndex <= visibleIndex
    })

  return {
    ...detection,
    swings: byIndex(detection.swings),
    classifiedSwings: byIndex(detection.classifiedSwings),
    bosEvents: byIndex(detection.bosEvents),
    chochEvents: byIndex(detection.chochEvents),
    displacementEvents: byIndex(detection.displacementEvents),
    fvgEvents: byIndex(detection.fvgEvents),
    equalLevelEvents: byIndex(detection.equalLevelEvents),
    liquiditySweepEvents: byIndex(detection.liquiditySweepEvents),
    orderBlockEvents: byIndex(detection.orderBlockEvents),
  }
}

function findEvent(detection: SmcDetectionResult, id: string | null): SmcEvent | null {
  if (!id) return null
  return flattenDetectionEvents(detection).find((e) => e.id === id) ?? null
}

function fingerprintPrice(event: SmcEvent, candles: readonly { close: number }[]): number {
  if ('price' in event && typeof event.price === 'number' && Number.isFinite(event.price)) {
    return event.price
  }
  if (
    'closePrice' in event &&
    typeof event.closePrice === 'number' &&
    Number.isFinite(event.closePrice)
  ) {
    return event.closePrice
  }
  if ('close' in event && typeof event.close === 'number' && Number.isFinite(event.close)) {
    return event.close
  }
  if ('level' in event && typeof event.level === 'number' && Number.isFinite(event.level)) {
    return event.level
  }
  if ('sweptLevel' in event && typeof event.sweptLevel === 'number') return event.sweptLevel
  if ('midpoint' in event && typeof event.midpoint === 'number') return event.midpoint
  if ('zoneHigh' in event && typeof event.zoneHigh === 'number') return event.zoneHigh
  const close = candles[event.candleIndex]?.close
  if (close != null && Number.isFinite(close)) return close
  return Number.NaN
}

function derivePeriodLabel(selection: ResearchPeriodSelection): string {
  if (selection.preset !== 'custom') {
    return (
      RESEARCH_PERIOD_PRESET_OPTIONS.find((o) => o.id === selection.preset)?.label ??
      selection.preset
    )
  }
  const fmt = (ms: number | undefined) =>
    ms != null ? new Date(ms).toLocaleDateString() : '?'
  return `${fmt(selection.customStartMs)} – ${fmt(selection.customEndMs)}`
}

/**
 * Isolated SMC Lab workspace. Does not touch Strategy / Research / Backtest stores.
 */
export function SmcLabPage() {
  const initialPrefs = useMemo(() => loadSmcLabPreferences(), [])
  const { activeTab, setTab } = useSmcLabTab()

  const [sourceKind, setSourceKind] = useState<MarketSourceKind>(DEFAULT_MARKET_SOURCE.kind)
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('1h')
  const [periodSelection, setPeriodSelection] = useState<ResearchPeriodSelection>(
    defaultResearchPeriodSelection,
  )

  const [config, setConfig] = useState<SmcDetectorConfig>(initialPrefs.detectorConfig)
  const [layers, setLayers] = useState<SmcChartLayerToggles>(() => ({
    ...initialPrefs.layerToggles,
    dowTheoryLabels: initialPrefs.layerToggles.dowTheoryLabels ?? true,
  }))
  const [densityPreset, setDensityPreset] = useState<SmcDensityPreset>(
    initialPrefs.densityPreset,
  )
  const [visibilityMode, setVisibilityMode] = useState<SmcVisibilityModePref>(
    initialPrefs.visibilityMode ?? 'balanced',
  )
  const [smartVisibilityPreset, setSmartVisibilityPreset] =
    useState<SmcSmartVisibilityPresetPref>(
      initialPrefs.smartVisibilityPreset ?? 'balanced',
    )
  const [zoneLifecycle, setZoneLifecycle] = useState<SmcZoneLifecycleSettings>(
    initialPrefs.zoneLifecycle ?? {
      showActive: true,
      showTouched: true,
      showMitigatedFilled: false,
      showInvalidated: false,
      extendActiveZonesRight: true,
      fadeOldActiveZones: true,
    },
  )
  const [setupContext, setSetupContext] = useState<SmcSetupVisualContext | null>(null)
  const [priorSmartPreset, setPriorSmartPreset] =
    useState<SmcSmartVisibilityPresetPref>('balanced')
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null)
  const [setupReviews, setSetupReviews] = useState<SetupReviewRecord[]>([])
  const [setupReviewNote, setSetupReviewNote] = useState('')
  const [setupReviewVerdict, setSetupReviewVerdict] = useState<SetupReviewVerdict | null>(
    null,
  )
  const [selectedQmlId, setSelectedQmlId] = useState<string | null>(null)
  const [activeProfileId, setActiveProfileId] = useState(initialPrefs.activeProfileId)
  const [speed, setSpeed] = useState<SmcPlaySpeed>(initialPrefs.playSpeed)

  const [detection, setDetection] = useState<SmcDetectionResult>(emptyDetection)
  const [detecting, setDetecting] = useState(false)
  const [detectionProgress, setDetectionProgress] = useState<number | null>(null)
  const [moduleProgress, setModuleProgress] = useState<SmcModuleProgress[] | null>(null)
  const [visibleIndex, setVisibleIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [eventFilter, setEventFilter] = useState<SmcEventFilter>('ALL')
  const [reviews, setReviews] = useState<SmcReviewRecord[]>([])
  const [annotations, setAnnotations] = useState<SmcManualAnnotation[]>([])
  const [goldenDatasets, setGoldenDatasets] = useState<SmcGoldenDataset[]>([])
  const [activeGoldenId, setActiveGoldenId] = useState<string | null>(null)
  const [validationReport, setValidationReport] = useState<SmcValidationReport | null>(null)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<SmcWrongTag[]>([])
  const [compareProfileId, setCompareProfileId] = useState<string | null>(
    initialPrefs.compareProfileId,
  )
  const [compareCounts, setCompareCounts] = useState<{
    nameA: string
    nameB: string
    a: SmcProfileCompareCounts
    b: SmcProfileCompareCounts
  } | null>(null)
  const [candleDiffText, setCandleDiffText] = useState<string | null>(null)
  const [savedConfigName, setSavedConfigName] = useState('')
  const [manualKind, setManualKind] = useState<SmcManualAnnotation['kind']>('NOTE')
  const [manualPrice, setManualPrice] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [savedTick, setSavedTick] = useState(0)
  const [appliedConfigHash, setAppliedConfigHash] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const playTimer = useRef<number | null>(null)

  const resolvedPeriod = useMemo(() => {
    try {
      return { period: resolveResearchPeriod(periodSelection), error: null as string | null }
    } catch (error) {
      return {
        period: null,
        error: error instanceof Error ? error.message : 'Invalid research period',
      }
    }
  }, [periodSelection])

  const candlesQuery = useResearchCandles({
    sourceKind,
    datasetId,
    symbol,
    interval,
    startTime: resolvedPeriod.period?.startMs ?? null,
    endTime: resolvedPeriod.period?.endMs ?? null,
  })

  const candles = candlesQuery.data ?? []
  const datasetKey = buildDatasetKey({ sourceKind, symbol, timeframe: interval, datasetId })
  const configHash = hashSmcConfig(config)

  const configDirty = hasUnappliedDetectionConfig({
    currentConfigHash: configHash,
    appliedConfigHash,
  })

  const periodLabel = useMemo(() => derivePeriodLabel(periodSelection), [periodSelection])

  const progressive = useMemo(() => {
    if (candles.length === 0) return emptyDetection()
    return progressiveFilter(detection, visibleIndex)
  }, [detection, visibleIndex, candles.length])

  const progressiveVisible = useMemo(
    () => filterDetectionByRanking(progressive),
    [progressive],
  )

  const lifecycleProjection = useMemo(
    () =>
      projectSmcLifecycle({
        detection: progressive,
        visibleIndex,
        preset: smartVisibilityPreset as SmcSmartVisibilityPreset,
        settings: zoneLifecycle,
        setup: setupContext,
      }),
    [progressive, visibleIndex, smartVisibilityPreset, zoneLifecycle, setupContext],
  )

  const setupEngineResult: SetupEngineResult | null = useMemo(() => {
    if (candles.length === 0 || detection.diagnostics.candleCount <= 0) return null
    return evaluateSetups({
      candles,
      detection: progressive,
      visibleIndex,
      dowTheory: analyzeDowTheory(progressive.classifiedSwings, visibleIndex),
      qml: progressive.qml ?? detection.qml,
      lifecycleZones: lifecycleProjection.zones,
    })
  }, [
    candles,
    detection.diagnostics.candleCount,
    detection.qml,
    progressive,
    visibleIndex,
    lifecycleProjection.zones,
  ])

  const selectedSetup = useMemo(() => {
    if (!selectedSetupId || !setupEngineResult) return null
    return setupEngineResult.setups.find((s) => s.id === selectedSetupId) ?? null
  }, [selectedSetupId, setupEngineResult])

  const setupValidationMetrics = useMemo(
    () => (setupReviews.length ? computeSetupValidationMetrics(setupReviews) : null),
    [setupReviews],
  )

  const dowTheoryView = useMemo(() => {
    const live = analyzeDowTheory(progressive.classifiedSwings, visibleIndex)
    const fromResult = detection.dowTheory
    if (
      fromResult &&
      detection.diagnostics.visibleThroughIndex != null &&
      visibleIndex >= detection.diagnostics.visibleThroughIndex &&
      progressive.classifiedSwings.length === detection.classifiedSwings.length
    ) {
      return fromResult
    }
    return live
  }, [
    progressive.classifiedSwings,
    visibleIndex,
    detection.dowTheory,
    detection.diagnostics.visibleThroughIndex,
    detection.classifiedSwings.length,
  ])

  const selectedZone: SmcZoneProjection | null = useMemo(() => {
    if (!selectedZoneId) return null
    return (
      lifecycleProjection.zones.find((z) => z.zoneId === selectedZoneId) ??
      lifecycleProjection.visibleZones.find((z) => z.zoneId === selectedZoneId) ??
      null
    )
  }, [selectedZoneId, lifecycleProjection])

  const dowChartVisibility = useMemo(
    () =>
      projectDowChartVisibility({
        classifiedSwings: progressive.classifiedSwings,
        swingClassification: dowTheoryView.swingClassification,
        bySwingId: dowTheoryView.bySwingId,
        densityPreset,
        visibilityMode: visibilityMode as SmcVisibilityMode,
        intelligence: detection.intelligence,
        structureEvents: lifecycleProjection.structureEvents,
        selectedEventId,
        visibleIndex,
        showDowTheoryLabels: layers.dowTheoryLabels ?? true,
      }),
    [
      progressive.classifiedSwings,
      dowTheoryView.swingClassification,
      dowTheoryView.bySwingId,
      densityPreset,
      visibilityMode,
      detection.intelligence,
      lifecycleProjection.structureEvents,
      selectedEventId,
      visibleIndex,
      layers.dowTheoryLabels,
    ],
  )

  const chartStructure = useMemo(() => {
    const base = (() => {
      if (smartVisibilityPreset === 'debug') {
        return {
          swings: progressiveVisible.swings,
          classifiedSwings: progressiveVisible.classifiedSwings,
          bosEvents: progressiveVisible.bosEvents,
          chochEvents: progressiveVisible.chochEvents,
          displacementEvents: progressiveVisible.displacementEvents,
        }
      }
      const visibleIds = new Set(
        lifecycleProjection.structureEvents.filter((s) => s.visible).map((s) => s.eventId),
      )
      const keep = <T extends { id: string }>(events: T[]) =>
        events.filter((e) => visibleIds.has(e.id))
      return {
        swings: keep(progressiveVisible.swings),
        classifiedSwings: keep(progressiveVisible.classifiedSwings),
        bosEvents: keep(progressiveVisible.bosEvents),
        chochEvents: keep(progressiveVisible.chochEvents),
        displacementEvents: keep(progressiveVisible.displacementEvents),
      }
    })()

    return {
      ...base,
      classifiedSwings: mergeDowProtectedSwings(
        base.classifiedSwings,
        dowChartVisibility.visibleSwings,
      ),
    }
  }, [
    progressiveVisible,
    lifecycleProjection.structureEvents,
    smartVisibilityPreset,
    dowChartVisibility.visibleSwings,
  ])

  const chartDowMarkers = useMemo(() => {
    const showDow = layers.dowTheoryLabels ?? true
    return projectSwingChartMarkers(
      chartStructure.classifiedSwings,
      dowTheoryView.swingClassification,
      dowTheoryView.bySwingId,
      showDow,
    )
  }, [
    chartStructure.classifiedSwings,
    dowTheoryView.swingClassification,
    dowTheoryView.bySwingId,
    layers.dowTheoryLabels,
  ])

  const { windowStart, windowCandles, highlightSwingId } = useMemo(() => {
    const maxVisible = Math.min(candles.length - 1, visibleIndex)
    if (maxVisible < 0 || candles.length === 0) {
      return {
        windowStart: 0,
        windowCandles: [] as typeof candles,
        highlightSwingId: null as string | null,
      }
    }

    let center = maxVisible
    let spanStart = Math.max(0, maxVisible - CHART_WINDOW + 1)
    let spanEnd = maxVisible + 1
    let brokenId: string | null = null

    if (selectedEventId) {
      const event = findEvent(progressive, selectedEventId)
      if (event) {
        if ('brokenSwingCandleIndex' in event) {
          brokenId = event.brokenSwingId
          const left = Math.min(event.brokenSwingCandleIndex, event.candleIndex)
          const right = Math.max(event.brokenSwingCandleIndex, event.candleIndex)
          spanStart = Math.max(0, left - FOCUS_PAD)
          spanEnd = Math.min(maxVisible + 1, right + FOCUS_PAD + 1)
          if (spanEnd - spanStart > CHART_WINDOW) {
            center = event.candleIndex
            spanStart = Math.max(0, center - Math.floor(CHART_WINDOW * 0.65))
            spanEnd = Math.min(maxVisible + 1, spanStart + CHART_WINDOW)
            spanStart = Math.max(0, spanEnd - CHART_WINDOW)
          }
        } else {
          center = event.candleIndex
          spanStart = Math.max(0, center - Math.floor(CHART_WINDOW * 0.65))
          spanEnd = Math.min(maxVisible + 1, spanStart + CHART_WINDOW)
          spanStart = Math.max(0, spanEnd - CHART_WINDOW)
        }
      }
    } else if (setupContext) {
      const idxs = setupContext.eventIds
        .map((id) => findEvent(progressive, id)?.candleIndex)
        .filter((n): n is number => typeof n === 'number')
      if (idxs.length > 0) {
        const left = Math.min(...idxs)
        const right = Math.max(...idxs)
        spanStart = Math.max(0, left - FOCUS_PAD)
        spanEnd = Math.min(maxVisible + 1, right + FOCUS_PAD + 1)
        if (spanEnd - spanStart > CHART_WINDOW) {
          center = Math.round((left + right) / 2)
          spanStart = Math.max(0, center - Math.floor(CHART_WINDOW * 0.65))
          spanEnd = Math.min(maxVisible + 1, spanStart + CHART_WINDOW)
          spanStart = Math.max(0, spanEnd - CHART_WINDOW)
        }
      } else {
        spanEnd = maxVisible + 1
        spanStart = Math.max(0, spanEnd - CHART_WINDOW)
      }
    } else {
      spanEnd = maxVisible + 1
      spanStart = Math.max(0, spanEnd - CHART_WINDOW)
    }

    return {
      windowStart: spanStart,
      windowCandles: candles.slice(spanStart, spanEnd),
      highlightSwingId: brokenId,
    }
  }, [candles, visibleIndex, selectedEventId, progressive, setupContext])

  const visibilityPipeline = useMemo(
    () =>
      buildLabVisibilityPipelineDiagnostics({
        fullDetection: progressive,
        chartDetection: progressiveVisible,
        layers,
        windowStart,
        windowLength: windowCandles.length,
        listFilter: eventFilter,
        rankingVisibleOnly: visibilityMode !== 'debug',
      }),
    [
      progressive,
      progressiveVisible,
      layers,
      windowStart,
      windowCandles.length,
      eventFilter,
      visibilityMode,
    ],
  )

  const reviewsByEventId = useMemo(() => {
    const map = new Map<string, SmcReviewRecord>()
    for (const review of reviews) {
      if (review.configHash === configHash) {
        map.set(review.fingerprint.eventId, review)
      }
    }
    return map
  }, [reviews, configHash])

  const selectedEvent = useMemo(
    () => findEvent(progressive, selectedEventId),
    [selectedEventId, progressive],
  )

  const selectedReview = selectedEventId ? reviewsByEventId.get(selectedEventId) ?? null : null
  const staleReview = useMemo(() => {
    if (!selectedEventId) return false
    const any = reviews.find((r) => r.fingerprint.eventId === selectedEventId)
    return Boolean(any && any.configHash !== configHash && !reviewsByEventId.has(selectedEventId))
  }, [reviews, selectedEventId, configHash, reviewsByEventId])

  const summary = useMemo(
    () =>
      buildReviewSummary({
        detection: progressive,
        reviews,
        activeConfigHash: configHash,
      }),
    [progressive, reviews, configHash],
  )

  // Persist prefs when config/layers/speed/profile change
  useEffect(() => {
    const prefs = loadSmcLabPreferences()
    saveSmcLabPreferences({
      ...prefs,
      schemaVersion: 2,
      detectorConfig: config,
      layerToggles: layers,
      densityPreset,
      visibilityMode,
      smartVisibilityPreset,
      zoneLifecycle,
      activeProfileId,
      playSpeed: speed,
      compareProfileId,
    })
  }, [
    config,
    layers,
    densityPreset,
    visibilityMode,
    smartVisibilityPreset,
    zoneLifecycle,
    activeProfileId,
    speed,
    compareProfileId,
  ])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const store = getSmcLabStore()
      const [nextReviews, nextAnnotations, nextGoldens] = await Promise.all([
        store.listReviews(datasetKey),
        store.listAnnotations(datasetKey),
        store.listGoldenDatasets(datasetKey),
      ])
      if (!cancelled) {
        setReviews(nextReviews)
        setAnnotations(nextAnnotations)
        setGoldenDatasets(nextGoldens)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [datasetKey])

  useEffect(() => {
    setVisibleIndex(Math.max(0, candles.length - 1))
    setPlaying(false)
    setDetection(emptyDetection())
    setSelectedEventId(null)
    setSelectedZoneId(null)
    setSetupContext(null)
  }, [candles])

  useEffect(() => {
    if (!playing) {
      if (playTimer.current != null) {
        window.clearInterval(playTimer.current)
        playTimer.current = null
      }
      return
    }
    const ms = 400 / speed
    playTimer.current = window.setInterval(() => {
      setVisibleIndex((current) => {
        if (current >= candles.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, ms)
    return () => {
      if (playTimer.current != null) window.clearInterval(playTimer.current)
    }
  }, [playing, speed, candles.length])

  const applyDetection = useCallback(async () => {
    if (!candles.length) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setDetecting(true)
    setDetectionProgress(0)
    setModuleProgress(null)
    const { config: safe } = validateSmcDetectorConfig(config)
    setConfig(safe)
    updateSmcDetectorPrefs(safe)

    const appliedHash = hashSmcConfig(safe)

    const job = await runSmcDetectionJob({
      candles,
      visibleIndex: candles.length - 1,
      config: safe,
      signal: controller.signal,
      onProgress: setDetectionProgress,
      onModuleProgress: setModuleProgress,
    })

    if (job.status === 'cancelled' || !job.result) {
      setDetecting(false)
      setDetectionProgress(null)
      return
    }

    setDetection(withSmcVisibilityMode(job.result, visibilityMode))
    setVisibleIndex(candles.length - 1)
    setDetecting(false)
    setDetectionProgress(null)
    setModuleProgress(job.moduleProgress)
    setAppliedConfigHash(appliedHash)
  }, [candles, config, visibilityMode])

  const handleVisibilityMode = useCallback((mode: SmcVisibilityModePref) => {
    setVisibilityMode(mode)
    setDetection((prev) => {
      if (prev.diagnostics.candleCount <= 0) return prev
      return withSmcVisibilityMode(prev, mode as SmcVisibilityMode)
    })
  }, [])

  const showStructureDowView = useCallback(() => {
    setDensityPreset('structure')
    setLayers(layersForDensityPreset('structure'))
  }, [])

  const showDebugDowView = useCallback(() => {
    setDensityPreset('full-debug')
    setLayers(layersForDensityPreset('full-debug'))
    handleVisibilityMode('debug')
  }, [handleVisibilityMode])

  const handleSmartVisibilityPreset = useCallback(
    (preset: SmcSmartVisibilityPresetPref) => {
      if (preset !== 'setup-focus') {
        setSmartVisibilityPreset(preset)
        setSetupContext(null)
        return
      }
      const mock = createMockSetupVisualContext(progressive, visibleIndex)
      if (!mock) return
      setPriorSmartPreset(
        smartVisibilityPreset === 'setup-focus' ? priorSmartPreset : smartVisibilityPreset,
      )
      setSetupContext(mock)
      setSmartVisibilityPreset('setup-focus')
    },
    [progressive, visibleIndex, smartVisibilityPreset, priorSmartPreset],
  )

  const exitSetupFocus = useCallback(() => {
    setSetupContext(null)
    setSelectedQmlId(null)
    setSelectedSetupId(null)
    setSmartVisibilityPreset(priorSmartPreset === 'setup-focus' ? 'balanced' : priorSmartPreset)
  }, [priorSmartPreset])

  const selectQmlPattern = useCallback(
    (pattern: QmlPattern) => {
      setSelectedQmlId(pattern.id)
      setSelectedZoneId(pattern.zoneId)
      setSelectedEventId(null)
      setSelectedSetupId(null)
      setPriorSmartPreset(
        smartVisibilityPreset === 'setup-focus' ? priorSmartPreset : smartVisibilityPreset,
      )
      setSetupContext(createQmlSetupVisualContext(pattern))
      setSmartVisibilityPreset('setup-focus')
    },
    [smartVisibilityPreset, priorSmartPreset],
  )

  const selectSetup = useCallback(
    (setup: TradingSetup) => {
      setSelectedSetupId(setup.id)
      setSelectedEventId(null)
      setSelectedQmlId(null)
      const zoneId = setup.entryZone?.sourceId ?? null
      setSelectedZoneId(zoneId)
      setPriorSmartPreset(
        smartVisibilityPreset === 'setup-focus' ? priorSmartPreset : smartVisibilityPreset,
      )
      setSetupContext(createSetupEngineVisualContext(setup))
      setSmartVisibilityPreset('setup-focus')
      const existing = setupReviews.find((r) => r.setupId === setup.id)
      setSetupReviewVerdict(existing?.verdict ?? null)
      setSetupReviewNote(existing?.note ?? '')
    },
    [smartVisibilityPreset, priorSmartPreset, setupReviews],
  )

  const clearSelectedSetup = useCallback(() => {
    setSelectedSetupId(null)
    setSetupReviewNote('')
    setSetupReviewVerdict(null)
    if (setupContext?.setupId.startsWith('setup-')) {
      setSetupContext(null)
      setSmartVisibilityPreset(
        priorSmartPreset === 'setup-focus' ? 'balanced' : priorSmartPreset,
      )
    }
  }, [setupContext, priorSmartPreset])

  const handleSetupVerdict = useCallback(
    (verdict: SetupReviewVerdict) => {
      if (!selectedSetup) return
      const record = createSetupReview({
        setup: selectedSetup,
        verdict,
        note: setupReviewNote,
      })
      setSetupReviews((prev) => upsertSetupReview(prev, record))
      setSetupReviewVerdict(verdict)
    },
    [selectedSetup, setupReviewNote],
  )

  const handleResetSetupReview = useCallback(() => {
    if (!selectedSetupId) return
    setSetupReviews((prev) => prev.filter((r) => r.setupId !== selectedSetupId))
    setSetupReviewVerdict(null)
    setSetupReviewNote('')
  }, [selectedSetupId])

  const clearMarkers = useCallback(() => {
    setDetection(emptyDetection())
    setSelectedEventId(null)
    setSelectedZoneId(null)
    setSelectedQmlId(null)
    setSelectedSetupId(null)
    setSetupContext(null)
  }, [])

  const handleApplyProfile = useCallback((profile: SmcDetectionProfile) => {
    setConfig(cloneSmcDetectorConfig(profile.config))
    setActiveProfileId(String(profile.id))
  }, [])

  const handleVerdict = useCallback(
    async (verdict: 'correct' | 'wrong' | 'unsure') => {
      if (!selectedEvent) return
      const fingerprint = buildEventFingerprint({
        eventId: selectedEvent.id,
        kind: selectedEvent.kind,
        candleIndex: selectedEvent.candleIndex,
        timestamp: selectedEvent.timestamp,
        price: fingerprintPrice(selectedEvent, candles),
        brokenSwingId:
          'brokenSwingId' in selectedEvent ? selectedEvent.brokenSwingId : undefined,
        profileId: activeProfileId,
      })
      const record: SmcReviewRecord = {
        id: createReviewId(fingerprint, configHash),
        fingerprint,
        detectorVersion: SMC_DETECTOR_VERSION,
        configSnapshot: cloneSmcDetectorConfig(config),
        configHash,
        profileId: activeProfileId,
        verdict,
        reasonTags: verdict === 'wrong' ? tags : [],
        note,
        reviewedAt: Date.now(),
        datasetKey,
      }
      await getSmcLabStore().putReview(record)
      setReviews(await getSmcLabStore().listReviews(datasetKey))
    },
    [selectedEvent, candles, activeProfileId, configHash, config, tags, note, datasetKey],
  )

  const handleResetReview = useCallback(async () => {
    if (!selectedEvent) return
    const existing = reviewsByEventId.get(selectedEvent.id)
    if (existing) {
      await getSmcLabStore().deleteReview(existing.id)
      setReviews(await getSmcLabStore().listReviews(datasetKey))
    }
    setNote('')
    setTags([])
  }, [selectedEvent, reviewsByEventId, datasetKey])

  const addManualAnnotation = useCallback(async () => {
    const price = Number(manualPrice)
    if (!Number.isFinite(price) || candles.length === 0) return
    const candle = candles[Math.min(visibleIndex, candles.length - 1)]!
    const annotation: SmcManualAnnotation = {
      id: `ann-${Date.now()}`,
      kind: manualKind,
      datasetKey,
      sourceKind,
      symbol,
      timeframe: interval,
      timestamp: candle.time,
      price,
      note: manualNote,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await getSmcLabStore().putAnnotation(annotation)
    setAnnotations(await getSmcLabStore().listAnnotations(datasetKey))
    setManualNote('')
  }, [manualPrice, candles, visibleIndex, manualKind, datasetKey, sourceKind, symbol, interval, manualNote])

  const exportResearch = useCallback(() => {
    const payload: SmcLabExportPayload = {
      schemaVersion: 3,
      exportedAt: Date.now(),
      detectorVersion: SMC_DETECTOR_VERSION,
      detectorConfig: cloneSmcDetectorConfig(config),
      profileId: activeProfileId,
      reviews,
      annotations,
      goldenDatasets,
      dataset: {
        datasetKey,
        sourceKind,
        symbol,
        timeframe: interval,
        startMs: candles[0]?.time ?? null,
        endMs: candles.at(-1)?.time ?? null,
        candleCount: candles.length,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `smc-lab-${symbol}-${interval}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [config, activeProfileId, reviews, annotations, goldenDatasets, datasetKey, sourceKind, symbol, interval, candles])

  const importResearch = useCallback(async (file: File) => {
    const text = await file.text()
    const payload = validateSmcLabExport(JSON.parse(text))
    const store = getSmcLabStore()
    for (const review of payload.reviews) await store.putReview(review)
    for (const annotation of payload.annotations) await store.putAnnotation(annotation)
    for (const golden of payload.goldenDatasets ?? []) await store.putGoldenDataset(golden)
    setConfig(cloneSmcDetectorConfig(payload.detectorConfig))
    if (payload.profileId) setActiveProfileId(payload.profileId)
    setReviews(await store.listReviews(datasetKey))
    setAnnotations(await store.listAnnotations(datasetKey))
    setGoldenDatasets(await store.listGoldenDatasets(datasetKey))
  }, [datasetKey])

  const saveGoldenFromCorrectReviews = useCallback(async () => {
    const probes = toDetectedProbes(detection)
    const byId = new Map(probes.map((p) => [p.id, p]))
    const correct = reviews.filter(
      (r) =>
        r.verdict === 'correct' &&
        r.configHash === configHash &&
        r.detectorVersion === SMC_DETECTOR_VERSION,
    )
    const labels = correct
      .map((r) => {
        const probe = byId.get(r.fingerprint.eventId)
        if (!probe) {
          const module = validationModuleForKind(r.fingerprint.kind)
          if (!module) return null
          return goldenLabelFromProbe({
            id: r.fingerprint.eventId,
            kind: r.fingerprint.kind,
            candleIndex: r.fingerprint.candleIndex,
            timestamp: r.fingerprint.timestamp,
            price: r.fingerprint.price,
            sourceStructureId: r.fingerprint.brokenSwingId ?? null,
          })
        }
        return goldenLabelFromProbe(probe)
      })
      .filter((l): l is NonNullable<typeof l> => l != null)

    if (labels.length === 0) return

    const id = createGoldenDatasetId({
      datasetKey,
      detectorVersion: SMC_DETECTOR_VERSION,
      configFingerprint: configHash,
    })
    const now = Date.now()
    const dataset: SmcGoldenDataset = {
      id,
      name: `${symbol} ${interval} · ${labels.length} labels`,
      sourceKind,
      symbol,
      timeframe: interval,
      datasetKey,
      startMs: candles[0]?.time ?? null,
      endMs: candles.at(-1)?.time ?? null,
      detectorVersion: SMC_DETECTOR_VERSION,
      configFingerprint: configHash,
      profileId: activeProfileId,
      labels,
      createdAt: now,
      updatedAt: now,
    }
    await getSmcLabStore().putGoldenDataset(dataset)
    const next = await getSmcLabStore().listGoldenDatasets(datasetKey)
    setGoldenDatasets(next)
    setActiveGoldenId(id)
  }, [detection, reviews, configHash, datasetKey, symbol, interval, sourceKind, activeProfileId, candles])

  const runValidation = useCallback(() => {
    const dataset =
      goldenDatasets.find((d) => d.id === activeGoldenId) ?? goldenDatasets[0] ?? null
    if (!dataset) {
      setValidationReport(null)
      return
    }
    const report = evaluateSmcValidation({
      dataset,
      detection,
      candles,
      config,
      reviews: reviews.map((r) => ({
        eventId: r.fingerprint.eventId,
        kind: r.fingerprint.kind,
        module: validationModuleForKind(r.fingerprint.kind),
        verdict: r.verdict,
        reasonTags: r.reasonTags,
        configFingerprint: r.configHash,
        detectorVersion: r.detectorVersion,
      })),
    })
    setValidationReport(report)
    setActiveGoldenId(dataset.id)
  }, [goldenDatasets, activeGoldenId, detection, candles, config, reviews])

  const deleteGoldenDataset = useCallback(async (id: string) => {
    await getSmcLabStore().deleteGoldenDataset(id)
    const next = await getSmcLabStore().listGoldenDatasets(datasetKey)
    setGoldenDatasets(next)
    if (activeGoldenId === id) {
      setActiveGoldenId(null)
      setValidationReport(null)
    }
  }, [datasetKey, activeGoldenId])

  const loadSavedConfig = useCallback((entry: SmcSavedLabConfig) => {
    setConfig(cloneSmcDetectorConfig(entry.config))
    if (entry.profileId) setActiveProfileId(entry.profileId)
  }, [])

  // Profile comparison — aggregate counts only (no overlay by default)
  useEffect(() => {
    if (!compareProfileId || candles.length === 0) {
      setCompareCounts(null)
      setCandleDiffText(null)
      return
    }
    let cancelled = false
    void (async () => {
      const profileA =
        getBuiltinSmcProfile(activeProfileId) ??
        ({ ...QUANTLAB_DEFAULT_PROFILE, config } as SmcDetectionProfile)
      const profileB = getBuiltinSmcProfile(compareProfileId)
      if (!profileB) {
        setCompareCounts(null)
        return
      }
      const configA =
        activeProfileId === 'custom' ? config : cloneSmcDetectorConfig(profileA.config)
      const [jobA, jobB] = await Promise.all([
        runSmcDetectionJob({
          candles,
          visibleIndex: candles.length - 1,
          config: configA,
        }),
        runSmcDetectionJob({
          candles,
          visibleIndex: candles.length - 1,
          config: profileB.config,
        }),
      ])
      if (cancelled || !jobA.result || !jobB.result) return
      setCompareCounts({
        nameA: profileA.name,
        nameB: profileB.name,
        a: countProfileEvents(jobA.result, {
          correct: summary.overall.correct,
          wrong: summary.overall.wrong,
        }),
        b: countProfileEvents(jobB.result),
      })
      const eventsA = eventsAtCandle(jobA.result, visibleIndex).map((e) => e.kind)
      const eventsB = eventsAtCandle(jobB.result, visibleIndex).map((e) => e.kind)
      setCandleDiffText(
        describeCandleEventDifference({
          profileAName: profileA.name,
          profileBName: profileB.name,
          eventsA,
          eventsB,
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [compareProfileId, candles, config, activeProfileId, visibleIndex, summary.overall.correct, summary.overall.wrong])

  // savedTick bumps after save/delete so Saved configs section re-reads storage
  void savedTick

  const invariants = detection.diagnostics.invariants
  const detectionComplete = Boolean(
    detection.diagnostics.candleCount > 0 && invariants?.ok !== false,
  )
  const moduleBuckets = Object.values(summary.byModule).filter((b) => b.detected > 0)

  const sharedControls: SmcLabWorkspaceModel['sharedControls'] = useMemo(() => ({
    config,
    layers,
    densityPreset,
    activeProfileId,
    detecting,
    detectionProgress,
    moduleProgress,
    onChangeConfig: (next: SmcDetectorConfig) => {
      setConfig(next)
      setActiveProfileId('custom')
    },
    onChangeLayers: setLayers,
    onChangeDensityPreset: setDensityPreset,
    onChangeProfileId: setActiveProfileId,
    onApplyProfile: handleApplyProfile,
    onResetDefaults: () => {
      setConfig(cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG))
      setActiveProfileId('quantlab-default')
    },
    onApply: () => void applyDetection(),
    onClearMarkers: clearMarkers,
    onLoadSavedConfig: loadSavedConfig,
    onDeleteSavedConfig: () => setSavedTick((t) => t + 1),
    compareProfileId,
    onCompareProfileId: setCompareProfileId,
  }), [
    config,
    layers,
    densityPreset,
    activeProfileId,
    detecting,
    detectionProgress,
    moduleProgress,
    handleApplyProfile,
    applyDetection,
    clearMarkers,
    loadSavedConfig,
    compareProfileId,
  ])

  /** Wrapper for workspace selectEvent — also navigates candle + loads review. */
  const selectEvent = useCallback(
    (id: string) => {
      setSelectedEventId(id)
      setSelectedZoneId(null)
      const event = findEvent(progressive, id)
      if (event) {
        setVisibleIndex((v) => Math.max(v, event.candleIndex))
        const review = reviewsByEventId.get(id)
        setNote(review?.note ?? '')
        setTags(review?.reasonTags ?? [])
      }
    },
    [progressive, reviewsByEventId],
  )

  const onSelectRelated = useCallback(
    (id: string) => {
      setSelectedEventId(id)
      setSelectedZoneId(null)
      const event = findEvent(progressive, id) ?? findEvent(detection, id)
      if (event) {
        setVisibleIndex((v) => Math.max(v, event.candleIndex))
        const review = reviewsByEventId.get(id)
        setNote(review?.note ?? '')
        setTags(review?.reasonTags ?? [])
      }
    },
    [progressive, detection, reviewsByEventId],
  )

  const relatedForSelected = useMemo(
    () =>
      selectedEventId
        ? relatedEventsByRank(detection, selectedEventId)
        : { higher: [], nearbyLower: [] },
    [detection, selectedEventId],
  )

  const getEventImportanceWrapper = useCallback(
    (eventId: string) => getEventImportance(detection, eventId),
    [detection],
  )

  const workspaceModel = useMemo((): SmcLabWorkspaceModel => ({
    // Market
    sourceKind,
    setSourceKind,
    datasetId,
    setDatasetId,
    symbol,
    setSymbol,
    interval,
    setInterval,
    periodSelection,
    setPeriodSelection,
    periodLabel,
    candles,
    candlesLoading: candlesQuery.isLoading || candlesQuery.isFetching,
    candlesError: candlesQuery.isError
      ? candlesQuery.error instanceof Error
        ? candlesQuery.error.message
        : 'Failed to load candles'
      : null,
    providerLabel: candlesQuery.providerLabel ?? '',
    periodError: resolvedPeriod.error,

    // Config / view
    config,
    setConfig,
    layers,
    setLayers,
    densityPreset,
    setDensityPreset,
    visibilityMode,
    handleVisibilityMode,
    smartVisibilityPreset,
    handleSmartVisibilityPreset,
    exitSetupFocus,
    zoneLifecycle,
    setZoneLifecycle,
    setupContext,
    activeProfileId,
    setActiveProfileId,
    applyProfile: handleApplyProfile,
    resetDefaults: () => {
      setConfig(cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG))
      setActiveProfileId('quantlab-default')
    },
    compareProfileId,
    setCompareProfileId,
    compareCounts,
    candleDiffText,
    savedConfigName,
    setSavedConfigName,
    savedTick,
    bumpSavedTick: () => setSavedTick((t) => t + 1),
    loadSavedConfig,

    // Detection
    detection,
    progressive,
    progressiveVisible,
    detecting,
    detectionProgress,
    moduleProgress,
    applyDetection: () => void applyDetection(),
    clearMarkers,
    configDirty,
    appliedConfigHash,

    // Chart / replay
    windowCandles,
    windowStart,
    chartStructure,
    highlightSwingId,
    visibleIndex,
    setVisibleIndex,
    playing,
    setPlaying,
    speed,
    setSpeed,
    annotations,
    setAnnotations,
    selectedEventId,
    setSelectedEventId,
    selectedZoneId,
    setSelectedZoneId,
    selectedQmlId,
    selectQmlPattern,
    selectedEvent,
    selectedZone,
    eventFilter,
    setEventFilter,
    selectEvent,

    // Setup Engine
    setupEngineResult,
    selectedSetupId,
    selectedSetup,
    selectSetup,
    clearSelectedSetup,
    setupReviews,
    setupValidationMetrics,
    setupReviewNote,
    setSetupReviewNote,
    setupReviewVerdict,
    handleSetupVerdict,
    handleResetSetupReview,

    // Dow
    dowTheoryView,
    dowChartVisibility,
    chartDowMarkers,
    showStructureDowView,
    showDebugDowView,
    lifecycleProjection,

    // Reviews / validation
    reviews,
    reviewsByEventId,
    selectedReview,
    reviewStale: staleReview,
    note,
    setNote,
    tags,
    setTags,
    handleVerdict: (verdict) => void handleVerdict(verdict),
    handleResetReview: () => void handleResetReview(),
    summary,
    moduleBuckets,
    goldenDatasets,
    activeGoldenId,
    setActiveGoldenId,
    validationReport,
    saveGoldenFromCorrectReviews: () => void saveGoldenFromCorrectReviews(),
    runValidation,
    deleteGoldenDataset: (id) => void deleteGoldenDataset(id),
    manualKind,
    setManualKind,
    manualPrice,
    setManualPrice,
    manualNote,
    setManualNote,
    addManualAnnotation: () => void addManualAnnotation(),
    datasetKey,

    // Diagnostics
    visibilityPipeline,
    invariants,
    detectionComplete,
    exportResearch,
    importResearch,

    // Shared controls
    sharedControls,

    getEventImportance: getEventImportanceWrapper,
    relatedForSelected,
    onSelectRelated,
    visibilityModeTyped: visibilityMode as SmcVisibilityMode,
  }), [
    sourceKind, datasetId, symbol, interval, periodSelection, periodLabel, candles,
    candlesQuery.isLoading, candlesQuery.isFetching, candlesQuery.isError, candlesQuery.error,
    candlesQuery.providerLabel, resolvedPeriod.error,
    config, layers, densityPreset, visibilityMode, handleVisibilityMode,
    smartVisibilityPreset, handleSmartVisibilityPreset, exitSetupFocus,
    zoneLifecycle, setupContext, activeProfileId, handleApplyProfile,
    compareProfileId, compareCounts, candleDiffText, savedConfigName, savedTick, loadSavedConfig,
    detection, progressive, progressiveVisible, detecting, detectionProgress, moduleProgress,
    applyDetection, clearMarkers, configDirty, appliedConfigHash,
    windowCandles, windowStart, chartStructure, highlightSwingId,
    visibleIndex, playing, speed, annotations, selectedEventId, selectedZoneId,
    selectedQmlId, selectQmlPattern,
    selectedEvent, selectedZone, eventFilter, selectEvent,
    setupEngineResult, selectedSetupId, selectedSetup, selectSetup, clearSelectedSetup,
    setupReviews, setupValidationMetrics, setupReviewNote, setupReviewVerdict,
    handleSetupVerdict, handleResetSetupReview,
    dowTheoryView, dowChartVisibility, chartDowMarkers, showStructureDowView, showDebugDowView,
    lifecycleProjection,
    reviews, reviewsByEventId, selectedReview, staleReview, note, tags,
    handleVerdict, handleResetReview, summary, moduleBuckets,
    goldenDatasets, activeGoldenId, validationReport,
    saveGoldenFromCorrectReviews, runValidation, deleteGoldenDataset,
    manualKind, manualPrice, manualNote, addManualAnnotation, datasetKey,
    visibilityPipeline, invariants, detectionComplete, exportResearch, importResearch,
    sharedControls, getEventImportanceWrapper, relatedForSelected, onSelectRelated,
  ])

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4">
      {/* Page header */}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
            <FlaskConical className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">SMC Lab</h2>
              <Badge variant="outline" className="text-[10px]">
                Isolated Lab · Phase 3
              </Badge>
            </div>
            <p className="text-pretty text-xs text-muted-foreground">
              Detector finds events; intelligence ranks what you see
            </p>
            <p className="text-pretty text-[11px] text-muted-foreground">
              Detections in this lab do not affect strategies, backtests, optimization, or live
              trading.
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <SmcLabWorkspaceTabs activeTab={activeTab} onChange={setTab} />

      {/* Workspace panels — all mounted, inactive ones are CSS-hidden to preserve DOM state */}
      <SmcLabWorkspaceProvider value={workspaceModel}>
        <div className={activeTab === 'analyze' ? undefined : 'hidden'}>
          <SmcAnalyzeWorkspace />
        </div>
        <div className={activeTab === 'configure' ? undefined : 'hidden'}>
          <SmcConfigureWorkspace />
        </div>
        <div className={activeTab === 'validate' ? undefined : 'hidden'}>
          <SmcValidateWorkspace />
        </div>
        <div className={activeTab === 'diagnostics' ? undefined : 'hidden'}>
          <SmcDiagnosticsWorkspace />
        </div>
      </SmcLabWorkspaceProvider>
    </div>
  )
}
