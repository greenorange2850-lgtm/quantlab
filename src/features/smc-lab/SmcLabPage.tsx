import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlaskConical, Download, Upload, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { Input } from '@/components/ui/input'
import { MarketSourceFields } from '@/components/market/MarketSourceFields'
import {
  ResearchPeriodSelect,
  defaultResearchPeriodSelection,
} from '@/components/market/ResearchPeriodSelect'
import { useResearchCandles } from '@/api/queries/research-candles'
import {
  cloneSmcDetectorConfig,
  countProfileEvents,
  createGoldenDatasetId,
  DEFAULT_SMC_DETECTOR_CONFIG,
  describeCandleEventDifference,
  emptySmcDetectionResult,
  evaluateSmcValidation,
  eventsAtCandle,
  filterDetectionByRanking,
  getBuiltinSmcProfile,
  getEventImportance,
  goldenLabelFromProbe,
  QUANTLAB_DEFAULT_PROFILE,
  relatedEventsByRank,
  SMC_DETECTOR_VERSION,
  toDetectedProbes,
  validateSmcDetectorConfig,
  validationModuleForKind,
  withSmcVisibilityMode,
  type SmcDetectionProfile,
  type SmcDetectionResult,
  type SmcDetectorConfig,
  type SmcEvent,
  type SmcGoldenDataset,
  type SmcProfileCompareCounts,
  type SmcValidationReport,
  type SmcVisibilityMode,
} from '@/core/smc'
import { DEFAULT_MARKET_SOURCE, type MarketSourceKind } from '@/data/market-source'
import { resolveResearchPeriod, type ResearchPeriodSelection } from '@/data/research-period'
import { SmcCandlestickChart, type SmcChartLayerToggles } from './components/SmcCandlestickChart'
import { SmcControlsPanel } from './components/SmcControlsPanel'
import { SmcCursorControls, type SmcPlaySpeed } from './components/SmcCursorControls'
import { SmcEventInspector } from './components/SmcEventInspector'
import { SmcEventList, type SmcEventFilter } from './components/SmcEventList'
import {
  loadSmcLabPreferences,
  saveSmcLabPreferences,
  saveSmcNamedConfig,
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
  type SmcVisibilityModePref,
  type SmcWrongTag,
} from './persistence/types'
import {
  buildReviewSummary,
  flattenDetectionEvents,
  formatReviewedAccuracy,
} from './review-summary'
import {
  runSmcDetectionJob,
  type SmcModuleProgress,
} from './run-detection-job'
import { SmcGoldenChartCompare, SmcValidationDashboard } from './validation'
import type { SmcSavedLabConfig } from './persistence/types'

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
  // Never invent 0 — use NaN so fingerprints stay honest when data is absent.
  return Number.NaN
}

/**
 * Isolated SMC Lab workspace. Does not touch Strategy / Research / Backtest stores.
 */
export function SmcLabPage() {
  const initialPrefs = useMemo(() => loadSmcLabPreferences(), [])

  const [sourceKind, setSourceKind] = useState<MarketSourceKind>(DEFAULT_MARKET_SOURCE.kind)
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('1h')
  const [periodSelection, setPeriodSelection] = useState<ResearchPeriodSelection>(
    defaultResearchPeriodSelection,
  )

  const [config, setConfig] = useState<SmcDetectorConfig>(initialPrefs.detectorConfig)
  const [layers, setLayers] = useState<SmcChartLayerToggles>(initialPrefs.layerToggles)
  const [densityPreset, setDensityPreset] = useState<SmcDensityPreset>(
    initialPrefs.densityPreset,
  )
  const [visibilityMode, setVisibilityMode] = useState<SmcVisibilityModePref>(
    initialPrefs.visibilityMode ?? 'balanced',
  )
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

  const progressive = useMemo(() => {
    if (candles.length === 0) return emptyDetection()
    return progressiveFilter(detection, visibleIndex)
  }, [detection, visibleIndex, candles.length])

  /** Chart/list view — ranking-filtered; full `progressive` kept for Debug / inspector lookup. */
  const progressiveVisible = useMemo(
    () => filterDetectionByRanking(progressive),
    [progressive],
  )

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
    } else {
      spanEnd = maxVisible + 1
      spanStart = Math.max(0, spanEnd - CHART_WINDOW)
    }

    return {
      windowStart: spanStart,
      windowCandles: candles.slice(spanStart, spanEnd),
      highlightSwingId: brokenId,
    }
  }, [candles, visibleIndex, selectedEventId, progressive])

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
      activeProfileId,
      playSpeed: speed,
      compareProfileId,
    })
  }, [config, layers, densityPreset, visibilityMode, activeProfileId, speed, compareProfileId])

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
  }, [candles, config, visibilityMode])

  const handleVisibilityMode = useCallback((mode: SmcVisibilityModePref) => {
    setVisibilityMode(mode)
    setDetection((prev) => {
      if (prev.diagnostics.candleCount <= 0) return prev
      return withSmcVisibilityMode(prev, mode as SmcVisibilityMode)
    })
  }, [])

  const clearMarkers = () => {
    setDetection(emptyDetection())
    setSelectedEventId(null)
  }

  const handleApplyProfile = (profile: SmcDetectionProfile) => {
    setConfig(cloneSmcDetectorConfig(profile.config))
    setActiveProfileId(String(profile.id))
  }

  const handleVerdict = async (verdict: 'correct' | 'wrong' | 'unsure') => {
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
  }

  const handleResetReview = async () => {
    if (!selectedEvent) return
    const existing = reviewsByEventId.get(selectedEvent.id)
    if (existing) {
      await getSmcLabStore().deleteReview(existing.id)
      setReviews(await getSmcLabStore().listReviews(datasetKey))
    }
    setNote('')
    setTags([])
  }

  const addManualAnnotation = async () => {
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
  }

  const exportResearch = () => {
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
  }

  const importResearch = async (file: File) => {
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
  }

  const saveGoldenFromCorrectReviews = async () => {
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
  }

  const runValidation = () => {
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
  }

  const deleteGoldenDataset = async (id: string) => {
    await getSmcLabStore().deleteGoldenDataset(id)
    const next = await getSmcLabStore().listGoldenDatasets(datasetKey)
    setGoldenDatasets(next)
    if (activeGoldenId === id) {
      setActiveGoldenId(null)
      setValidationReport(null)
    }
  }

  const loadSavedConfig = (entry: SmcSavedLabConfig) => {
    setConfig(cloneSmcDetectorConfig(entry.config))
    if (entry.profileId) setActiveProfileId(entry.profileId)
  }

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

  const sharedControls = {
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
  }

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4">
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

      {/* 1. Source / Symbol / TF */}
      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Market data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MarketSourceFields
            idPrefix="smc"
            value={{ sourceKind, datasetId, symbol, interval }}
            onChange={(next) => {
              if (next.sourceKind !== undefined) setSourceKind(next.sourceKind)
              if (next.datasetId !== undefined) setDatasetId(next.datasetId)
              if (next.symbol !== undefined) setSymbol(next.symbol)
              if (next.interval !== undefined) setInterval(next.interval)
            }}
            onDatasetReady={(dataset) => {
              setPeriodSelection({
                preset: 'custom',
                customStartMs: dataset.startDate,
                customEndMs: dataset.endDate,
              })
            }}
          />
          {sourceKind === 'binance' ? (
            <ResearchPeriodSelect
              idPrefix="smc-period"
              selection={periodSelection}
              onChange={setPeriodSelection}
            />
          ) : null}
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline">{sourceKind}</Badge>
            <Badge variant="outline" className="font-mono">
              {symbol}
            </Badge>
            <Badge variant="outline">{interval}</Badge>
            <Badge variant="outline">{candles.length.toLocaleString()} candles</Badge>
            {candlesQuery.isLoading || candlesQuery.isFetching ? (
              <span>Loading via {candlesQuery.providerLabel}…</span>
            ) : null}
            {candlesQuery.isError ? (
              <span className="text-danger">
                {candlesQuery.error instanceof Error
                  ? candlesQuery.error.message
                  : 'Failed to load candles'}
              </span>
            ) : null}
            {resolvedPeriod.error ? (
              <span className="text-danger">{resolvedPeriod.error}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 2. Profile */}
      <SmcControlsPanel {...sharedControls} sections={['profile', 'density']} />

      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Intelligence visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Ranking filters display only — detector events are never deleted.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['focus', 'Focus', 'Highest ranked only'],
                ['balanced', 'Balanced', 'Default QuantLab view'],
                ['debug', 'Debug', 'Everything'],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                className={`min-h-11 rounded-lg border px-3 text-left text-sm ${
                  visibilityMode === id
                    ? 'border-amber-500/50 bg-amber-500/15'
                    : 'border-border bg-white/[0.03]'
                }`}
                onClick={() => handleVisibilityMode(id)}
              >
                <span className="font-medium">{label}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          {detection.diagnostics.ranking ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              Visible {detection.diagnostics.ranking.visibleEvents} / detected{' '}
              {detection.diagnostics.ranking.detectedEvents} · hidden by ranking{' '}
              {detection.diagnostics.ranking.hiddenByRanking}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. Apply Detection */}
      <SmcControlsPanel {...sharedControls} sections={['modules', 'actions']} />

      {/* 4. Chart */}
      <SmcCandlestickChart
        candles={windowCandles}
        swings={progressiveVisible.swings}
        classifiedSwings={progressiveVisible.classifiedSwings}
        bosEvents={progressiveVisible.bosEvents}
        chochEvents={progressiveVisible.chochEvents}
        displacementEvents={progressiveVisible.displacementEvents}
        fvgEvents={progressiveVisible.fvgEvents}
        equalLevelEvents={progressiveVisible.equalLevelEvents}
        liquiditySweepEvents={progressiveVisible.liquiditySweepEvents}
        orderBlockEvents={progressiveVisible.orderBlockEvents}
        annotations={annotations}
        selectedEventId={selectedEventId}
        highlightSwingId={highlightSwingId}
        layers={layers}
        windowStartIndex={windowStart}
        importanceById={detection.intelligence?.byEventId}
      />

      <SmcCursorControls
        visibleIndex={visibleIndex}
        candleCount={candles.length}
        playing={playing}
        speed={speed}
        onFirst={() => setVisibleIndex(0)}
        onPrev={() => setVisibleIndex((v) => Math.max(0, v - 1))}
        onNext={() => setVisibleIndex((v) => Math.min(candles.length - 1, v + 1))}
        onLast={() => setVisibleIndex(Math.max(0, candles.length - 1))}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onSpeedChange={setSpeed}
      />

      {/* 5. Inspector */}
      <SmcEventInspector
        event={selectedEvent}
        candles={candles}
        swings={progressive.swings}
        review={selectedReview}
        reviewStale={staleReview}
        note={note}
        tags={tags}
        onNoteChange={setNote}
        onTagsChange={setTags}
        onVerdict={(v) => void handleVerdict(v)}
        onResetReview={() => void handleResetReview()}
        importance={selectedEventId ? getEventImportance(detection, selectedEventId) : null}
        related={
          selectedEventId
            ? relatedEventsByRank(detection, selectedEventId)
            : { higher: [], nearbyLower: [] }
        }
        onSelectRelated={(id) => {
          setSelectedEventId(id)
          const event = findEvent(progressive, id) ?? findEvent(detection, id)
          if (event) {
            setVisibleIndex((v) => Math.max(v, event.candleIndex))
            const review = reviewsByEventId.get(id)
            setNote(review?.note ?? '')
            setTags(review?.reasonTags ?? [])
          }
        }}
      />

      {/* 6. Event List */}
      <SmcEventList
        detection={progressive}
        candles={candles}
        reviewsByEventId={reviewsByEventId}
        filter={eventFilter}
        selectedEventId={selectedEventId}
        onFilterChange={setEventFilter}
        onSelect={(id) => {
          setSelectedEventId(id)
          const event = findEvent(progressive, id)
          if (event) {
            setVisibleIndex((v) => Math.max(v, event.candleIndex))
            const review = reviewsByEventId.get(id)
            setNote(review?.note ?? '')
            setTags(review?.reasonTags ?? [])
          }
        }}
        rankingVisibleOnly={visibilityMode !== 'debug'}
        importanceById={detection.intelligence?.byEventId}
      />

      {/* Profile comparison aggregates */}
      {compareCounts ? (
        <Card hover={false}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Profile comparison (aggregate counts)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CompareStat label={`${compareCounts.nameA} swings`} value={compareCounts.a.confirmedSwings} />
              <CompareStat label={`${compareCounts.nameB} swings`} value={compareCounts.b.confirmedSwings} />
              <CompareStat label={`${compareCounts.nameA} BOS`} value={compareCounts.a.bullishBos + compareCounts.a.bearishBos} />
              <CompareStat label={`${compareCounts.nameB} BOS`} value={compareCounts.b.bullishBos + compareCounts.b.bearishBos} />
              <CompareStat label={`${compareCounts.nameA} CHoCH`} value={compareCounts.a.bullishChoch + compareCounts.a.bearishChoch} />
              <CompareStat label={`${compareCounts.nameB} CHoCH`} value={compareCounts.b.bullishChoch + compareCounts.b.bearishChoch} />
              <CompareStat label={`${compareCounts.nameA} FVG`} value={compareCounts.a.bullishFvg + compareCounts.a.bearishFvg} />
              <CompareStat label={`${compareCounts.nameB} FVG`} value={compareCounts.b.bullishFvg + compareCounts.b.bearishFvg} />
              <CompareStat label={`${compareCounts.nameA} Sweeps`} value={compareCounts.a.liquiditySweeps} />
              <CompareStat label={`${compareCounts.nameB} Sweeps`} value={compareCounts.b.liquiditySweeps} />
              <CompareStat label={`${compareCounts.nameA} OB`} value={compareCounts.a.orderBlocks} />
              <CompareStat label={`${compareCounts.nameB} OB`} value={compareCounts.b.orderBlocks} />
            </div>
            {candleDiffText ? (
              <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
                <p className="mb-1 font-medium">Selected candle event difference</p>
                <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground">
                  {candleDiffText}
                </pre>
              </div>
            ) : null}
            <p className="text-muted-foreground">
              Overlay is off by default — comparison shows aggregate counts only.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* 7. Review Summary */}
      <Disclosure title="Review summary">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Detected (unique reviewable)</p>
              <p className="font-mono">{summary.overall.detected}</p>
              <p className="text-[10px] text-muted-foreground">
                Lifecycle updates excluded: {summary.lifecycleUpdateCount}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Reviewed</p>
              <p className="font-mono">{summary.overall.reviewed}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Correct / Wrong</p>
              <p className="font-mono">
                {summary.overall.correct} / {summary.overall.wrong}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Reviewed agreement</p>
              <p className="font-mono">{formatReviewedAccuracy(summary.overall)}</p>
            </div>
          </div>
          {moduleBuckets.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium">By module</p>
              <ul className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
                {moduleBuckets.map((bucket) => (
                  <li
                    key={String(bucket.kind)}
                    className="flex items-center justify-between rounded-md border border-border/50 px-2 py-1"
                  >
                    <span>{bucket.kind}</span>
                    <span className="font-mono text-muted-foreground">
                      {bucket.correct}/{bucket.correct + bucket.wrong} ·{' '}
                      {formatReviewedAccuracy(bucket)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {(() => {
            const b = detection.diagnostics.structureBreakCounts
            const rows: Array<[string, number]> = [
              ['Internal Bullish BOS', b.internalBullishBos],
              ['Internal Bearish BOS', b.internalBearishBos],
              ['External Bullish BOS', b.externalBullishBos],
              ['External Bearish BOS', b.externalBearishBos],
              ['Internal Bullish CHoCH', b.internalBullishChoch],
              ['Internal Bearish CHoCH', b.internalBearishChoch],
              ['External Bullish CHoCH', b.externalBullishChoch],
              ['External Bearish CHoCH', b.externalBearishChoch],
            ]
            return (
              <div className="space-y-1">
                <p className="text-xs font-medium">Structure breaks (scope × direction)</p>
                <ul className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
                  {rows.map(([label, count]) => (
                    <li
                      key={label}
                      className="flex items-center justify-between rounded-md border border-border/50 px-2 py-1"
                    >
                      <span>{label}</span>
                      <span className="font-mono text-muted-foreground">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
          {summary.historicalReviews.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-200">
                Historical reviews (prior config / profile)
              </p>
              <p className="text-[11px] text-muted-foreground">
                {summary.historicalReviews.length} review
                {summary.historicalReviews.length === 1 ? '' : 's'} from earlier detector
                fingerprints remain stored but are excluded from active reviewed agreement.
              </p>
            </div>
          ) : null}
        </div>
      </Disclosure>

      {/* 7b. Validation Suite */}
      <SmcValidationDashboard
        report={validationReport}
        datasets={goldenDatasets}
        activeDatasetId={activeGoldenId}
        onSelectDataset={setActiveGoldenId}
        onSaveGoldenFromReviews={() => void saveGoldenFromCorrectReviews()}
        onRunValidation={runValidation}
        onDeleteDataset={(id) => void deleteGoldenDataset(id)}
      />
      {validationReport ? (
        <SmcGoldenChartCompare
          detected={toDetectedProbes(detection)}
          expected={
            goldenDatasets.find((d) => d.id === (activeGoldenId ?? validationReport.datasetId))
              ?.labels ?? []
          }
          matched={validationReport.matched}
          missed={validationReport.missed}
          extra={validationReport.extra}
        />
      ) : null}

      {/* 8. Advanced Settings */}
      <Disclosure title="Advanced settings">
        <SmcControlsPanel {...sharedControls} sections={['advanced', 'layers']} />
      </Disclosure>

      {/* 9. Saved Configs */}
      <Disclosure title="Saved configs & presets">
        <div className="space-y-3">
          <SmcControlsPanel {...sharedControls} sections={['presets', 'saved']} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={savedConfigName}
              onChange={(e) => setSavedConfigName(e.target.value)}
              placeholder="New config name"
              className="bg-white/[0.03]"
            />
            <Button
              type="button"
              className="min-h-11"
              onClick={() => {
                saveSmcNamedConfig({
                  name: savedConfigName || 'Untitled',
                  config,
                  profileId: activeProfileId,
                })
                setSavedConfigName('')
                setSavedTick((t) => t + 1)
              }}
            >
              Save current
            </Button>
          </div>
        </div>
      </Disclosure>

      {invariants ? (
        <Card hover={false} className={invariants.ok ? '' : 'border-danger/40'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Invariant report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <p>Invalid bullish BOS: {invariants.invalidBullishBosCount}</p>
              <p>Invalid bearish BOS: {invariants.invalidBearishBosCount}</p>
              <p>BOS before confirmation: {invariants.bosBeforeConfirmationCount}</p>
              <p>Duplicate break of same swing: {invariants.repeatedSwingBreakCount}</p>
              <p>BOS+CHoCH same swing: {invariants.duplicateBreakOfSameSwingCount}</p>
              <p>CHoCH without opposing structure: {invariants.chochWithoutPriorStructureCount}</p>
              <p>Invalid bullish CHoCH: {invariants.invalidBullishChochCount}</p>
              <p>Invalid bearish CHoCH: {invariants.invalidBearishChochCount}</p>
              <p>Invalid FVG geometry: {invariants.fvgInvalidGeometryCount}</p>
              <p>Sweep without penetration: {invariants.sweepWithoutPenetrationCount}</p>
              <p>Sweep without close reclaim: {invariants.sweepWithoutCloseReclaimCount}</p>
              <p>Repeated consumed-level sweep: {invariants.repeatedConsumedLevelSweepCount}</p>
              <p>Order Block after source break: {invariants.orderBlockAfterSourceBreakCount}</p>
              <p>Missing dependency reference: {invariants.dependencyReferenceMissingCount}</p>
              <p>Event timestamp mismatch: {invariants.eventTimestampMismatchCount}</p>
              <p>Artificial zero display value: {invariants.artificialZeroDisplayValueCount}</p>
              <p className="font-medium">
                Status:{' '}
                {detectionComplete && invariants.ok
                  ? 'COMPLETE (0 failures)'
                  : 'FAILED'}
              </p>
            </div>
            {!invariants.ok && detection.diagnostics.invariantDetails?.length ? (
              <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-4 text-danger">
                {detection.diagnostics.invariantDetails.slice(0, 20).map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Disclosure title="Manual annotations">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="h-11 rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
              value={manualKind}
              onChange={(e) =>
                setManualKind(e.target.value as SmcManualAnnotation['kind'])
              }
            >
              <option value="MANUAL_SWING_HIGH">Manual Swing High</option>
              <option value="MANUAL_SWING_LOW">Manual Swing Low</option>
              <option value="MANUAL_BULLISH_BOS">Manual Bullish BOS</option>
              <option value="MANUAL_BEARISH_BOS">Manual Bearish BOS</option>
              <option value="MANUAL_BULLISH_CHOCH">Manual Bullish CHoCH</option>
              <option value="MANUAL_BEARISH_CHOCH">Manual Bearish CHoCH</option>
              <option value="NOTE">Note</option>
            </select>
            <Input
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="Price"
              className="bg-white/[0.03]"
            />
            <Input
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Note"
              className="bg-white/[0.03]"
            />
            <Button type="button" className="min-h-11" onClick={() => void addManualAnnotation()}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {annotations.map((ann) => (
              <li
                key={ann.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1"
              >
                <span>
                  {ann.kind} · {ann.price} · {new Date(ann.timestamp).toLocaleString()}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void getSmcLabStore()
                      .deleteAnnotation(ann.id)
                      .then(async () =>
                        setAnnotations(await getSmcLabStore().listAnnotations(datasetKey)),
                      )
                  }
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Disclosure>

      {/* 10–11. Diagnostics + Import/Export */}
      <Disclosure title="Diagnostics">
        <div className="space-y-3 text-[11px]">
          {(() => {
            const s = detection.diagnostics.summary
            const b = detection.diagnostics.structureBreakCounts
            const sweep = detection.diagnostics.liquiditySweepDiagnostics
            const breakdown = detection.diagnostics.eventCountBreakdown
            return (
              <>
                <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3 font-mono leading-relaxed">
                  <p>{s.candleCount} candles</p>
                  <p className="mt-2">Unique reviewable events: {s.uniqueReviewableEvents}</p>
                  <p>Lifecycle updates: {s.lifecycleUpdates}</p>
                  <p>
                    Visible events:{' '}
                    {detection.diagnostics.ranking?.visibleEvents ??
                      (windowCandles.length > 0
                        ? flattenDetectionEvents(progressiveVisible).filter(
                            (e) =>
                              e.candleIndex >= windowStart &&
                              e.candleIndex < windowStart + windowCandles.length,
                          ).length
                        : 0)}
                  </p>
                  <p>Total events: {s.totalEvents}</p>
                  {detection.diagnostics.ranking ? (
                    <>
                      <p className="mt-2">
                        Detected Events: {detection.diagnostics.ranking.detectedEvents}
                      </p>
                      <p>Visible Events: {detection.diagnostics.ranking.visibleEvents}</p>
                      <p>Hidden by Ranking: {detection.diagnostics.ranking.hiddenByRanking}</p>
                      <p>Average Importance: {detection.diagnostics.ranking.averageImportance}</p>
                      <p>Highest Importance: {detection.diagnostics.ranking.highestImportance}</p>
                      <p>Lowest Importance: {detection.diagnostics.ranking.lowestImportance}</p>
                      <p>Visibility mode: {detection.diagnostics.ranking.mode}</p>
                    </>
                  ) : null}
                  <p className="mt-2">External swings: {s.externalSwings}</p>
                  <p>Internal swings: {s.internalSwings}</p>
                  <p className="mt-2">External BOS: {s.externalBos}</p>
                  <p>Internal BOS: {s.internalBos}</p>
                  <p>External CHoCH: {s.externalChoch}</p>
                  <p>Internal CHoCH: {s.internalChoch}</p>
                  <p className="mt-2">Liquidity levels: {s.liquidityLevels}</p>
                  <p>Raw sweep candidates: {s.rawSweepCandidates}</p>
                  <p>Unique valid sweeps: {s.uniqueValidSweeps}</p>
                  <p>Duplicates suppressed: {s.duplicateSweepsSuppressed}</p>
                  <p>Consumed attempts ignored: {s.consumedAttemptsIgnored}</p>
                  <p className="mt-2">
                    Invariants: {s.invariantFailures} failure
                    {s.invariantFailures === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <p>Detector {detection.diagnostics.detectorVersion}</p>
                  <p>Status {detection.diagnostics.detectionStatus}</p>
                  <p>Structure {detection.structureState}</p>
                  <p>Profile {activeProfileId}</p>
                  <p>Internal Bullish BOS {b.internalBullishBos}</p>
                  <p>Internal Bearish BOS {b.internalBearishBos}</p>
                  <p>External Bullish BOS {b.externalBullishBos}</p>
                  <p>External Bearish BOS {b.externalBearishBos}</p>
                  <p>Internal Bullish CHoCH {b.internalBullishChoch}</p>
                  <p>Internal Bearish CHoCH {b.internalBearishChoch}</p>
                  <p>External Bullish CHoCH {b.externalBullishChoch}</p>
                  <p>External Bearish CHoCH {b.externalBearishChoch}</p>
                  <p>FVG created {breakdown.fvgCreated}</p>
                  <p>FVG touched {breakdown.fvgTouched}</p>
                  <p>FVG half filled {breakdown.fvgHalfFilled}</p>
                  <p>FVG fully filled {breakdown.fvgFullyFilled}</p>
                  <p>FVG invalidated {breakdown.fvgInvalidated}</p>
                  <p>Unique FVG zones {breakdown.uniqueFvgZones}</p>
                  <p>OB created {breakdown.orderBlockCreated}</p>
                  <p>OB touched {breakdown.orderBlockTouched}</p>
                  <p>OB mitigated {breakdown.orderBlockMitigated}</p>
                  <p>OB invalidated {breakdown.orderBlockInvalidated}</p>
                  <p>Unique OB zones {breakdown.uniqueOrderBlockZones}</p>
                  <p>Canonical levels {sweep.canonicalLevelsConsidered}</p>
                  <p>Duration {detection.diagnostics.computationDurationMs.toFixed(1)} ms</p>
                </div>
                <p className="text-muted-foreground">{breakdown.explanation}</p>
                {detection.diagnostics.moduleTimings.map((t) => (
                  <p key={t.module}>
                    {t.module}: {t.status} ({t.durationMs.toFixed(1)} ms)
                  </p>
                ))}
              </>
            )
          })()}
        </div>
      </Disclosure>

      <Disclosure title="Import / export">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11" onClick={exportResearch}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON (schema v3)
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border px-3 text-sm">
            <Upload className="mr-2 h-4 w-4" />
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importResearch(file)
              }}
            />
          </label>
        </div>
      </Disclosure>
    </div>
  )
}

function CompareStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono">{value}</p>
    </div>
  )
}
