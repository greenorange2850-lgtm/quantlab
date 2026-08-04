import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SmcCandlestickChart } from '../components/SmcCandlestickChart'
import { SmcCursorControls } from '../components/SmcCursorControls'
import { SmcEventInspector } from '../components/SmcEventInspector'
import { SmcEventList } from '../components/SmcEventList'
import { layersForDensityPreset } from '../persistence/prefs-archive'
import { useMemo, useState } from 'react'
import { QmlInspector, QmlSetupsPanel, type QmlWrongTag } from '../qml'
import { SmcAppliedConfigSummary } from './SmcAppliedConfigSummary'
import { SmcQuickViewControls } from './SmcQuickViewControls'
import { useSmcLabWorkspace } from './SmcLabWorkspaceContext'
import type { SmcDensityPreset } from '../persistence/types'

export function SmcAnalyzeWorkspace() {
  const {
    sourceKind,
    symbol,
    interval,
    periodLabel,
    candles,
    layers,
    setLayers,
    densityPreset,
    setDensityPreset,
    visibilityMode,
    handleVisibilityMode,
    smartVisibilityPreset,
    handleSmartVisibilityPreset,
    activeProfileId,
    detection,
    progressive,
    progressiveVisible,
    detecting,
    detectionProgress,
    applyDetection,
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
    selectedEventId,
    setSelectedEventId,
    selectedZoneId,
    setSelectedZoneId,
    selectedQmlId,
    selectQmlPattern,
    selectedEvent,
    selectedZone,
    config,
    eventFilter,
    setEventFilter,
    selectEvent,
    lifecycleProjection,
    setupContext,
    dowTheoryView,
    dowChartVisibility,
    showStructureDowView,
    showDebugDowView,
    reviewsByEventId,
    selectedReview,
    reviewStale,
    note,
    setNote,
    tags,
    setTags,
    handleVerdict,
    handleResetReview,
    getEventImportance,
    relatedForSelected,
    onSelectRelated,
    visibilityModeTyped,
  } = useSmcLabWorkspace()

  const handleDensityChange = (preset: SmcDensityPreset) => {
    setDensityPreset(preset)
    setLayers(layersForDensityPreset(preset))
  }

  const [qmlNote, setQmlNote] = useState('')
  const [qmlTags, setQmlTags] = useState<QmlWrongTag[]>([])
  const [qmlVerdict, setQmlVerdict] = useState<'correct' | 'wrong' | 'unsure' | null>(null)

  const selectedQml = useMemo(() => {
    const patterns = progressive.qml?.patterns ?? detection.qml?.patterns ?? []
    return patterns.find((p) => p.id === selectedQmlId) ?? null
  }, [progressive.qml?.patterns, detection.qml?.patterns, selectedQmlId])

  return (
    <div
      id="smc-lab-panel-analyze"
      role="tabpanel"
      aria-labelledby="smc-lab-tab-analyze"
      className="space-y-4"
    >
      {/* Compact market context badges */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline">{sourceKind}</Badge>
        <Badge variant="outline" className="font-mono">
          {symbol}
        </Badge>
        <Badge variant="outline">{interval}</Badge>
        <Badge variant="outline">{candles.length.toLocaleString()} candles</Badge>
        {periodLabel ? <Badge variant="outline">{periodLabel}</Badge> : null}
      </div>

      {/* Applied config summary */}
      <SmcAppliedConfigSummary
        profileId={activeProfileId}
        densityPreset={densityPreset}
        visibilityMode={visibilityMode}
        smartVisibilityPreset={smartVisibilityPreset}
      />

      {/* Quick view controls */}
      <SmcQuickViewControls
        densityPreset={densityPreset}
        visibilityMode={visibilityMode}
        smartVisibilityPreset={smartVisibilityPreset}
        onDensityPresetChange={handleDensityChange}
        onVisibilityModeChange={handleVisibilityMode}
        onSmartVisibilityPresetChange={handleSmartVisibilityPreset}
      />

      {/* Apply Detection */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          className="min-h-11"
          disabled={detecting || candles.length === 0}
          onClick={applyDetection}
        >
          {detecting
            ? detectionProgress != null
              ? `Detecting… ${Math.round(detectionProgress * 100)}%`
              : 'Detecting…'
            : 'Apply Detection'}
        </Button>
      </div>

      {/* Desktop two-column: chart + inspector/list */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:gap-4">
        {/* Left column: chart + Dow + zone legend */}
        <div className="space-y-4">
          <SmcCandlestickChart
            candles={windowCandles}
            swings={chartStructure.swings}
            classifiedSwings={chartStructure.classifiedSwings}
            bosEvents={chartStructure.bosEvents}
            chochEvents={chartStructure.chochEvents}
            displacementEvents={chartStructure.displacementEvents}
            fvgEvents={progressiveVisible.fvgEvents}
            equalLevelEvents={progressiveVisible.equalLevelEvents}
            liquiditySweepEvents={progressiveVisible.liquiditySweepEvents}
            orderBlockEvents={progressiveVisible.orderBlockEvents}
            zoneProjections={lifecycleProjection.visibleZones}
            setupContext={setupContext}
            annotations={annotations}
            selectedEventId={selectedEventId}
            selectedZoneId={selectedZoneId}
            onSelectZone={(id) => {
              setSelectedZoneId(id)
              setSelectedEventId(null)
            }}
            highlightSwingId={highlightSwingId}
            layers={layers}
            windowStartIndex={windowStart}
            importanceById={detection.intelligence?.byEventId}
            dowSwingClassification={
              dowTheoryView.swingClassification ?? detection.dowTheory?.swingClassification ?? {}
            }
            dowBySwingId={dowTheoryView.bySwingId ?? detection.dowTheory?.bySwingId ?? {}}
          />

          {/* Dow Theory notice */}
          {dowChartVisibility.notice ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
              <p>{dowChartVisibility.notice.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={showStructureDowView}
                >
                  Show Structure view
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={showDebugDowView}>
                  Show Debug view
                </Button>
              </div>
            </div>
          ) : null}

          {/* Dow Theory summary */}
          <Card hover={false}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dow Theory</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 text-[11px]">
              <Badge variant="outline">{dowTheoryView.trend}</Badge>
              <span className="font-mono text-muted-foreground">
                Strength {dowTheoryView.strength} · {dowTheoryView.structurePhase}
              </span>
              <span className="font-mono text-muted-foreground">
                HH {dowTheoryView.diagnostics.hhCount} · HL {dowTheoryView.diagnostics.hlCount} ·
                LH {dowTheoryView.diagnostics.lhCount} · LL {dowTheoryView.diagnostics.llCount}
              </span>
              <span className="w-full font-mono text-[10px] text-muted-foreground">
                Dow visibility · classified {dowChartVisibility.diagnostics.classifiedDowCount} ·
                density {dowChartVisibility.diagnostics.densityEligibleDowCount} · ranking{' '}
                {dowChartVisibility.diagnostics.rankingVisibleDowCount} · chart{' '}
                {dowChartVisibility.diagnostics.chartRenderedDowCount} · hidden density{' '}
                {dowChartVisibility.diagnostics.hiddenByDensity} · hidden ranking{' '}
                {dowChartVisibility.diagnostics.hiddenByRanking}
              </span>
            </CardContent>
          </Card>

          {/* Zone legend */}
          <Card hover={false}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Zone legend</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
              <p>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-emerald-500/70" />
                Bullish FVG
              </p>
              <p>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-red-500/70" />
                Bearish FVG
              </p>
              <p>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-blue-500/70" />
                Bullish OB
              </p>
              <p>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-purple-500/70" />
                Bearish OB
              </p>
              <p>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-amber-500/70" />
                BSL / SSL
              </p>
              <p>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-teal-500/70" />
                Bullish QML
              </p>
              <p>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-orange-500/70" />
                Bearish QML
              </p>
              <p>Solid = Active/Fresh · Dotted = Touched/Partial · Faded = Finished</p>
              <p>Labels: FVG · OB · BSL · SSL · QML (+ ·T/·P/·M/·X/·S)</p>
            </CardContent>
          </Card>

          <QmlSetupsPanel
            qml={progressive.qml ?? detection.qml}
            visibilityMode={visibilityModeTyped}
            selectedQmlId={selectedQmlId}
            onSelect={selectQmlPattern}
            enabled={config.qml.enabled}
          />

          <QmlInspector
            pattern={selectedQml}
            note={qmlNote}
            tags={qmlTags}
            onNoteChange={setQmlNote}
            onTagsChange={setQmlTags}
            onVerdict={(v) => setQmlVerdict(v)}
            onResetReview={() => {
              setQmlVerdict(null)
              setQmlNote('')
              setQmlTags([])
            }}
            reviewVerdict={qmlVerdict}
          />

          {/* Mobile: cursor + inspector + event list */}
          <div className="space-y-4 lg:hidden">
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
            {selectedZone ? (
              <SelectedZoneCard
                selectedZone={selectedZone}
                candles={candles}
                onSelectSourceEvent={(id) => {
                  setSelectedEventId(id)
                  setSelectedZoneId(null)
                }}
                onClearZone={() => setSelectedZoneId(null)}
              />
            ) : null}
            <SmcEventInspector
              event={selectedEvent}
              candles={candles}
              swings={progressive.swings}
              review={selectedReview}
              reviewStale={reviewStale}
              note={note}
              tags={tags}
              onNoteChange={setNote}
              onTagsChange={setTags}
              onVerdict={(v) => handleVerdict(v)}
              onResetReview={handleResetReview}
              importance={selectedEventId ? getEventImportance(selectedEventId) : null}
              related={relatedForSelected}
              onSelectRelated={onSelectRelated}
              dowTheory={dowTheoryView}
            />
            <SmcEventList
              detection={progressive}
              candles={candles}
              reviewsByEventId={reviewsByEventId}
              filter={eventFilter}
              selectedEventId={selectedEventId}
              onFilterChange={setEventFilter}
              onSelect={selectEvent}
              rankingVisibleOnly={visibilityModeTyped !== 'debug'}
              importanceById={detection.intelligence?.byEventId}
            />
          </div>
        </div>

        {/* Right column: cursor + inspector + event list (desktop) */}
        <div className="hidden space-y-4 lg:block">
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
          {selectedZone ? (
            <SelectedZoneCard
              selectedZone={selectedZone}
              candles={candles}
              onSelectSourceEvent={(id) => {
                setSelectedEventId(id)
                setSelectedZoneId(null)
              }}
              onClearZone={() => setSelectedZoneId(null)}
            />
          ) : null}
          <SmcEventInspector
            event={selectedEvent}
            candles={candles}
            swings={progressive.swings}
            review={selectedReview}
            reviewStale={reviewStale}
            note={note}
            tags={tags}
            onNoteChange={setNote}
            onTagsChange={setTags}
            onVerdict={(v) => handleVerdict(v)}
            onResetReview={handleResetReview}
            importance={selectedEventId ? getEventImportance(selectedEventId) : null}
            related={relatedForSelected}
            onSelectRelated={onSelectRelated}
            dowTheory={dowTheoryView}
          />
          <SmcEventList
            detection={progressive}
            candles={candles}
            reviewsByEventId={reviewsByEventId}
            filter={eventFilter}
            selectedEventId={selectedEventId}
            onFilterChange={setEventFilter}
            onSelect={selectEvent}
            rankingVisibleOnly={visibilityModeTyped !== 'debug'}
            importanceById={detection.intelligence?.byEventId}
          />
        </div>
      </div>
    </div>
  )
}

interface SelectedZoneCardProps {
  selectedZone: NonNullable<ReturnType<typeof useSmcLabWorkspace>['selectedZone']>
  candles: ReturnType<typeof useSmcLabWorkspace>['candles']
  onSelectSourceEvent: (id: string) => void
  onClearZone: () => void
}

function SelectedZoneCard({
  selectedZone,
  candles,
  onSelectSourceEvent,
  onClearZone,
}: SelectedZoneCardProps) {
  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{selectedZone.fullLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">Kind: </span>
          {selectedZone.zoneKind} · {selectedZone.direction}
        </p>
        <p>
          <span className="text-muted-foreground">Source event: </span>
          <button
            type="button"
            className="font-mono text-sky-300 underline"
            onClick={() => onSelectSourceEvent(selectedZone.sourceEventId)}
          >
            {selectedZone.sourceEventId}
          </button>
        </p>
        <p>
          <span className="text-muted-foreground">State: </span>
          {selectedZone.state}
        </p>
        <p>
          <span className="text-muted-foreground">Still active: </span>
          {selectedZone.activeAtVisibleIndex ? 'yes' : 'no'}
        </p>
        <p>
          <span className="text-muted-foreground">Chart extent: </span>
          {selectedZone.startIndex} → {selectedZone.endIndex}
          {selectedZone.extendsToVisibleEdge ? ' (extends to visible)' : ' (clipped)'}
        </p>
        {selectedZone.firstTouchIndex != null ? (
          <p>
            <span className="text-muted-foreground">First touch: </span>
            candle {selectedZone.firstTouchIndex}
            {candles[selectedZone.firstTouchIndex]
              ? ` · ${new Date(candles[selectedZone.firstTouchIndex]!.time).toLocaleString()}`
              : ''}
          </p>
        ) : null}
        {selectedZone.mitigationIndex != null ? (
          <p>
            <span className="text-muted-foreground">Mitigation / fill: </span>
            candle {selectedZone.mitigationIndex}
            {candles[selectedZone.mitigationIndex]
              ? ` · ${new Date(candles[selectedZone.mitigationIndex]!.time).toLocaleString()}`
              : ''}
          </p>
        ) : null}
        {selectedZone.invalidationIndex != null ? (
          <p>
            <span className="text-muted-foreground">Invalidation: </span>
            candle {selectedZone.invalidationIndex}
          </p>
        ) : null}
        <p>
          <span className="text-muted-foreground">Why visible: </span>
          {selectedZone.visibilityReason}
        </p>
        <p>
          <span className="text-muted-foreground">Why extent: </span>
          {selectedZone.lifecycleReason}
        </p>
        <p>
          <span className="text-muted-foreground">Setup refs: </span>
          {selectedZone.setupRefs.length ? selectedZone.setupRefs.join(', ') : '—'}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={onClearZone}>
          Clear zone selection
        </Button>
      </CardContent>
    </Card>
  )
}
