import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { SmcCandlestickChart } from '../components/SmcCandlestickChart'
import { SmcCursorControls } from '../components/SmcCursorControls'
import { SmcEventInspector } from '../components/SmcEventInspector'
import { SmcEventList } from '../components/SmcEventList'
import { layersForDensityPreset } from '../persistence/prefs-archive'
import { useMemo, useState } from 'react'
import {
  MarketDecisionCard,
  MarketStructureCard,
  SetupProgressCard,
} from '../analyze'
import { QmlInspector, QmlSetupsPanel, type QmlWrongTag } from '../qml'
import { SetupInspector } from '../setup'
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
    setupEngineResult,
    selectedSetup,
    selectSetup,
    clearSelectedSetup,
    setupReviewNote,
    setSetupReviewNote,
    setupReviewVerdict,
    handleSetupVerdict,
    handleResetSetupReview,
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

  const activeSetup = selectedSetup ?? setupEngineResult?.summary.highestRanked ?? null

  return (
    <div
      id="smc-lab-panel-analyze"
      role="tabpanel"
      aria-labelledby="smc-lab-tab-analyze"
      className="space-y-4"
    >
      {/* Compact market context + run */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline">{sourceKind}</Badge>
        <Badge variant="outline" className="font-mono">
          {symbol}
        </Badge>
        <Badge variant="outline">{interval}</Badge>
        <Badge variant="outline">{candles.length.toLocaleString()} candles</Badge>
        {periodLabel ? <Badge variant="outline">{periodLabel}</Badge> : null}
        <Button
          type="button"
          size="sm"
          className="ml-auto min-h-10"
          disabled={detecting || candles.length === 0}
          onClick={applyDetection}
        >
          {detecting
            ? detectionProgress != null
              ? `Updating… ${Math.round(detectionProgress * 100)}%`
              : 'Updating…'
            : 'Update Market'}
        </Button>
      </div>

      {/* 1. Market Decision */}
      <MarketDecisionCard
        result={setupEngineResult}
        dow={dowTheoryView}
        selectedSetup={selectedSetup}
        onSelectSetup={selectSetup}
      />

      {/* 2 + 3. Market Structure / Setup Progress */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MarketStructureCard
          dow={dowTheoryView}
          dowChartVisibility={dowChartVisibility}
          onShowStructureView={showStructureDowView}
          onShowDebugView={showDebugDowView}
        />
        <SetupProgressCard
          setup={activeSetup}
          qml={progressive.qml ?? detection.qml}
          qmlEnabled={config.qml.enabled}
          onSelectQml={selectQmlPattern}
        />
      </div>

      {/* 4. Chart */}
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

      {/* 5. Setup Inspector */}
      <SetupInspector
        setup={activeSetup}
        note={setupReviewNote}
        onNoteChange={setSetupReviewNote}
        verdict={setupReviewVerdict}
        onVerdict={handleSetupVerdict}
        onResetReview={handleResetSetupReview}
        onClear={clearSelectedSetup}
      />

      {/* 6. Replay */}
      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Replay</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* 7. Advanced Details */}
      <Disclosure title="Advanced details" defaultOpen={false}>
        <div className="space-y-4">
          <SmcAppliedConfigSummary
            profileId={activeProfileId}
            densityPreset={densityPreset}
            visibilityMode={visibilityMode}
            smartVisibilityPreset={smartVisibilityPreset}
          />

          <SmcQuickViewControls
            densityPreset={densityPreset}
            visibilityMode={visibilityMode}
            smartVisibilityPreset={smartVisibilityPreset}
            onDensityPresetChange={handleDensityChange}
            onVisibilityModeChange={handleVisibilityMode}
            onSmartVisibilityPresetChange={handleSmartVisibilityPreset}
          />

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
                Bullish reversal zone
              </p>
              <p>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-orange-500/70" />
                Bearish reversal zone
              </p>
              <p>Solid = Active · Dotted = Touched · Faded = Finished</p>
            </CardContent>
          </Card>

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

          <div className="grid gap-4 lg:grid-cols-2">
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
      </Disclosure>
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
  const life = selectedZone.lifecycle
  const createdIdx = life?.createdIndex ?? selectedZone.startIndex
  const touchIdx = life?.firstTouchIndex ?? selectedZone.firstTouchIndex
  const mitigatedIdx = life?.mitigatedIndex ?? selectedZone.mitigationIndex
  const invalidatedIdx = life?.invalidatedIndex ?? selectedZone.invalidationIndex
  const fillPercent = life?.fillPercent
  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{selectedZone.fullLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">Kind: </span>
          {selectedZone.zoneKind} · {selectedZone.direction}
          {life ? ` · ${life.type}` : ''}
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
          <span className="text-muted-foreground">Current State: </span>
          {life?.currentState ?? selectedZone.state}
        </p>
        <p>
          <span className="text-muted-foreground">Age: </span>
          {life != null ? `${life.ageCandles} candles` : '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Touches: </span>
          {life != null ? life.touchCount : '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Fill %: </span>
          {fillPercent != null ? `${fillPercent}%` : '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Created: </span>
          candle {createdIdx}
          {candles[createdIdx]
            ? ` · ${new Date(candles[createdIdx]!.time).toLocaleString()}`
            : ''}
        </p>
        <p>
          <span className="text-muted-foreground">Touched: </span>
          {touchIdx != null
            ? `candle ${touchIdx}${
                candles[touchIdx]
                  ? ` · ${new Date(candles[touchIdx]!.time).toLocaleString()}`
                  : ''
              }`
            : '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Mitigated: </span>
          {mitigatedIdx != null ? `candle ${mitigatedIdx}` : '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Invalidated: </span>
          {invalidatedIdx != null ? `candle ${invalidatedIdx}` : '—'}
        </p>
        <p>
          <span className="text-muted-foreground">Reason: </span>
          {life?.reason ?? selectedZone.lifecycleReason}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={onClearZone}>
          Clear zone selection
        </Button>
      </CardContent>
    </Card>
  )
}
