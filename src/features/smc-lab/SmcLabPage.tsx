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
  DEFAULT_SMC_DETECTOR_CONFIG,
  detectSmc,
  SMC_DETECTOR_VERSION,
  validateSmcDetectorConfig,
  type SmcBosEvent,
  type SmcDetectionResult,
  type SmcDetectorConfig,
  type SmcSwingEvent,
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
  listSmcSavedConfigs,
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
  type SmcLabExportPayload,
  type SmcManualAnnotation,
  type SmcReviewRecord,
  type SmcWrongTag,
} from './persistence/types'
import { buildReviewSummary, formatReviewedAccuracy } from './review-summary'
import { runSmcDetectionJob } from './run-detection-job'
import type { SmcSavedLabConfig } from './persistence/types'

const CHART_WINDOW = 180

function emptyDetection(): SmcDetectionResult {
  return {
    swings: [],
    bosEvents: [],
    diagnostics: {
      detectorVersion: SMC_DETECTOR_VERSION,
      candleCount: 0,
      visibleThroughIndex: null,
      swingCandidatesConsidered: 0,
      confirmedSwings: 0,
      wickOnlyBreakCandidatesIgnored: 0,
      validBosEvents: 0,
      repeatedBreaksIgnored: 0,
      computationDurationMs: 0,
    },
  }
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
  const [speed, setSpeed] = useState<SmcPlaySpeed>(initialPrefs.playSpeed)

  const [detection, setDetection] = useState<SmcDetectionResult>(emptyDetection)
  const [detecting, setDetecting] = useState(false)
  const [detectionProgress, setDetectionProgress] = useState<number | null>(null)
  const [visibleIndex, setVisibleIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [eventFilter, setEventFilter] = useState<SmcEventFilter>('ALL')
  const [reviews, setReviews] = useState<SmcReviewRecord[]>([])
  const [annotations, setAnnotations] = useState<SmcManualAnnotation[]>([])
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<SmcWrongTag[]>([])
  const [compareConfigId, setCompareConfigId] = useState<string | null>(null)
  const [compareStats, setCompareStats] = useState<{
    name: string
    swings: number
    bos: number
  } | null>(null)
  const [manualKind, setManualKind] = useState<SmcManualAnnotation['kind']>('NOTE')
  const [manualPrice, setManualPrice] = useState('')
  const [manualNote, setManualNote] = useState('')

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
    return {
      ...detection,
      swings: detection.swings.filter((s) => s.confirmedAtIndex <= visibleIndex),
      bosEvents: detection.bosEvents.filter((e) => e.candleIndex <= visibleIndex),
    }
  }, [detection, visibleIndex, candles.length])

  // Window chart around cursor / selection — never show future candles.
  const focusIndex = useMemo(() => {
    if (!selectedEventId) return visibleIndex
    const event =
      progressive.swings.find((s) => s.id === selectedEventId) ??
      progressive.bosEvents.find((e) => e.id === selectedEventId)
    return event?.candleIndex ?? visibleIndex
  }, [selectedEventId, progressive, visibleIndex])

  const visibleEnd = Math.min(candles.length, Math.max(focusIndex, visibleIndex) + 1)
  const windowStart = Math.max(0, visibleEnd - CHART_WINDOW)
  const windowCandles = candles.slice(windowStart, visibleEnd)

  const reviewsByEventId = useMemo(() => {
    const map = new Map<string, SmcReviewRecord>()
    for (const review of reviews) {
      if (review.configHash === configHash) {
        map.set(review.fingerprint.eventId, review)
      }
    }
    return map
  }, [reviews, configHash])

  const selectedEvent: SmcSwingEvent | SmcBosEvent | null = useMemo(() => {
    if (!selectedEventId) return null
    return (
      progressive.swings.find((s) => s.id === selectedEventId) ??
      progressive.bosEvents.find((e) => e.id === selectedEventId) ??
      null
    )
  }, [selectedEventId, progressive])

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

  // Persist prefs when config/layers/speed change
  useEffect(() => {
    const prefs = loadSmcLabPreferences()
    saveSmcLabPreferences({
      ...prefs,
      detectorConfig: config,
      layerToggles: layers,
      playSpeed: speed,
    })
  }, [config, layers, speed])

  // Load reviews/annotations for dataset
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const store = getSmcLabStore()
      const [nextReviews, nextAnnotations] = await Promise.all([
        store.listReviews(datasetKey),
        store.listAnnotations(datasetKey),
      ])
      if (!cancelled) {
        setReviews(nextReviews)
        setAnnotations(nextAnnotations)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [datasetKey])

  // Reset cursor when candles change
  useEffect(() => {
    setVisibleIndex(Math.max(0, candles.length - 1))
    setPlaying(false)
    setDetection(emptyDetection())
    setSelectedEventId(null)
  }, [candles])

  // Play loop
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
    const { config: safe } = validateSmcDetectorConfig(config)
    setConfig(safe)
    updateSmcDetectorPrefs(safe)

    const job = await runSmcDetectionJob({
      candles,
      visibleIndex: candles.length - 1,
      config: safe,
      signal: controller.signal,
      onProgress: setDetectionProgress,
    })

    if (job.status === 'cancelled' || !job.result) {
      setDetecting(false)
      setDetectionProgress(null)
      return
    }

    setDetection(job.result)
    setVisibleIndex(candles.length - 1)
    setDetecting(false)
    setDetectionProgress(null)
  }, [candles, config])

  const clearMarkers = () => {
    setDetection(emptyDetection())
    setSelectedEventId(null)
  }

  const handleVerdict = async (verdict: 'correct' | 'wrong' | 'unsure') => {
    if (!selectedEvent) return
    const fingerprint = buildEventFingerprint({
      eventId: selectedEvent.id,
      kind: selectedEvent.kind,
      candleIndex: selectedEvent.candleIndex,
      timestamp: selectedEvent.timestamp,
      price: 'price' in selectedEvent ? selectedEvent.price : selectedEvent.closePrice,
      brokenSwingId:
        'brokenSwingId' in selectedEvent ? selectedEvent.brokenSwingId : undefined,
    })
    const record: SmcReviewRecord = {
      id: createReviewId(fingerprint, configHash),
      fingerprint,
      detectorVersion: SMC_DETECTOR_VERSION,
      configSnapshot: cloneSmcDetectorConfig(config),
      configHash,
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
      schemaVersion: 1,
      exportedAt: Date.now(),
      detectorVersion: SMC_DETECTOR_VERSION,
      detectorConfig: cloneSmcDetectorConfig(config),
      reviews,
      annotations,
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
    setConfig(cloneSmcDetectorConfig(payload.detectorConfig))
    setReviews(await store.listReviews(datasetKey))
    setAnnotations(await store.listAnnotations(datasetKey))
  }

  const loadSavedConfig = (entry: SmcSavedLabConfig) => {
    setConfig(cloneSmcDetectorConfig(entry.config))
  }

  useEffect(() => {
    if (!compareConfigId) {
      setCompareStats(null)
      return
    }
    const entry = listSmcSavedConfigs().find((c) => c.id === compareConfigId)
    if (!entry || candles.length === 0) {
      setCompareStats(null)
      return
    }
    const other = detectSmc(candles, entry.config)
    setCompareStats({
      name: entry.name,
      swings: other.swings.length,
      bos: other.bosEvents.length,
    })
  }, [compareConfigId, candles, config])

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
            <FlaskConical className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">SMC Lab</h2>
              <Badge variant="outline" className="text-[10px]">
                Isolated Lab
              </Badge>
            </div>
            <p className="text-pretty text-xs text-muted-foreground">
              Experimental visual detector workspace
            </p>
            <p className="text-pretty text-[11px] text-muted-foreground">
              Detections in this lab do not affect strategies, backtests, optimization, or live
              trading.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11" onClick={exportResearch}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
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
      </div>

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
            {candles[0] && candles.at(-1) ? (
              <span>
                {new Date(candles[0].time).toLocaleString()} →{' '}
                {new Date(candles.at(-1)!.time).toLocaleString()}
              </span>
            ) : null}
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SmcControlsPanel
          config={config}
          layers={layers}
          detecting={detecting}
          detectionProgress={detectionProgress}
          onChangeConfig={setConfig}
          onChangeLayers={setLayers}
          onResetDefaults={() => setConfig(cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG))}
          onApply={() => void applyDetection()}
          onClearMarkers={clearMarkers}
          onLoadSavedConfig={loadSavedConfig}
          compareConfigId={compareConfigId}
          onCompareConfigId={setCompareConfigId}
        />

        <div className="min-w-0 space-y-4">
          <SmcCandlestickChart
            candles={windowCandles}
            swings={progressive.swings}
            bosEvents={progressive.bosEvents}
            annotations={annotations}
            selectedEventId={selectedEventId}
            layers={layers}
            windowStartIndex={windowStart}
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

          {compareStats ? (
            <Card hover={false}>
              <CardContent className="space-y-1 py-3 text-xs">
                <p className="font-medium">Config comparison</p>
                <p>
                  Active: {progressive.swings.length} swings / {progressive.bosEvents.length} BOS
                </p>
                <p>
                  {compareStats.name}: {compareStats.swings} swings / {compareStats.bos} BOS
                </p>
                <p className="text-muted-foreground">
                  Reviewed accuracy (active): {formatReviewedAccuracy(summary.overall)}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SmcEventList
              swings={progressive.swings}
              bosEvents={progressive.bosEvents}
              reviewsByEventId={reviewsByEventId}
              filter={eventFilter}
              selectedEventId={selectedEventId}
              onFilterChange={setEventFilter}
              onSelect={(id) => {
                setSelectedEventId(id)
                const event =
                  progressive.swings.find((s) => s.id === id) ??
                  progressive.bosEvents.find((e) => e.id === id)
                if (event) {
                  setVisibleIndex((v) => Math.max(v, event.candleIndex))
                  const review = reviewsByEventId.get(id)
                  setNote(review?.note ?? '')
                  setTags(review?.reasonTags ?? [])
                }
              }}
            />
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
            />
          </div>

          <Card hover={false}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Review Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Detected</p>
                <p className="font-mono">{summary.overall.detected}</p>
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
                <p className="text-muted-foreground">Reviewed accuracy</p>
                <p className="font-mono">{formatReviewedAccuracy(summary.overall)}</p>
              </div>
              {(['SWING_HIGH', 'SWING_LOW', 'BULLISH_BOS', 'BEARISH_BOS'] as const).map(
                (kind) => (
                  <div key={kind} className="col-span-2 sm:col-span-1">
                    <p className="text-muted-foreground">{kind}</p>
                    <p className="font-mono text-[11px]">
                      {formatReviewedAccuracy(summary.byKind[kind])}
                      <span className="text-muted-foreground">
                        {' '}
                        · unreviewed {summary.byKind[kind].unreviewed}
                      </span>
                    </p>
                  </div>
                ),
              )}
            </CardContent>
          </Card>

          <Card hover={false}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Manual annotations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>

          <Disclosure title="Diagnostics" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
              <p>Detector {detection.diagnostics.detectorVersion}</p>
              <p>Candles {detection.diagnostics.candleCount}</p>
              <p>Visible through {visibleIndex}</p>
              <p>
                Pivot {config.swing.pivotLeft}/{config.swing.pivotRight}
              </p>
              <p>Min break % {config.bos.minimumBreakPercent}</p>
              <p>Candidates {detection.diagnostics.swingCandidatesConsidered}</p>
              <p>Confirmed swings {detection.diagnostics.confirmedSwings}</p>
              <p>Wick-only ignored {detection.diagnostics.wickOnlyBreakCandidatesIgnored}</p>
              <p>Valid BOS {detection.diagnostics.validBosEvents}</p>
              <p>Repeated ignored {detection.diagnostics.repeatedBreaksIgnored}</p>
              <p>Duration {detection.diagnostics.computationDurationMs.toFixed(1)} ms</p>
              <p>
                Window {windowStart}–{windowStart + windowCandles.length - 1}
              </p>
            </div>
          </Disclosure>
        </div>
      </div>
    </div>
  )
}
