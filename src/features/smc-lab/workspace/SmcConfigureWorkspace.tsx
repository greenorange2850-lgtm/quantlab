import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { Input } from '@/components/ui/input'
import { MarketSourceFields } from '@/components/market/MarketSourceFields'
import { ResearchPeriodSelect } from '@/components/market/ResearchPeriodSelect'
import { SmcControlsPanel } from '../components/SmcControlsPanel'
import { saveSmcNamedConfig } from '../persistence/prefs-archive'
import type { SmcVisibilityModePref } from '../persistence/types'
import { useSmcLabWorkspace } from './SmcLabWorkspaceContext'

export function SmcConfigureWorkspace() {
  const {
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
    candles,
    candlesLoading,
    candlesError,
    providerLabel,
    periodError,
    // Config
    config,
    visibilityMode,
    handleVisibilityMode,
    smartVisibilityPreset,
    handleSmartVisibilityPreset,
    exitSetupFocus,
    setupContext,
    zoneLifecycle,
    setZoneLifecycle,
    lifecycleProjection,
    detection,
    compareCounts,
    candleDiffText,
    savedConfigName,
    setSavedConfigName,
    bumpSavedTick,
    activeProfileId,
    // Detection
    detecting,
    detectionProgress,
    applyDetection,
    configDirty,
    // Shared controls
    sharedControls,
  } = useSmcLabWorkspace()

  return (
    <div
      id="smc-lab-panel-configure"
      role="tabpanel"
      aria-labelledby="smc-lab-tab-configure"
      className="space-y-3"
    >
      {/* Unsaved changes banner */}
      {configDirty ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          Unsaved configuration changes — detection result may not match current config.
        </div>
      ) : null}

      {/* Market */}
      <Disclosure title="Market" defaultOpen>
        <div className="space-y-3">
          <MarketSourceFields
            idPrefix="smc-cfg"
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
              idPrefix="smc-cfg-period"
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
            {candlesLoading ? <span>Loading via {providerLabel}…</span> : null}
            {candlesError ? <span className="text-danger">{candlesError}</span> : null}
            {periodError ? <span className="text-danger">{periodError}</span> : null}
          </div>
        </div>
      </Disclosure>

      {/* Detection: profile + compare */}
      <Disclosure title="Detection">
        <div className="space-y-4">
          <SmcControlsPanel {...sharedControls} sections={['profile']} />
          {compareCounts ? (
            <Card hover={false}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Profile comparison (aggregate counts)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <CompareStat
                    label={`${compareCounts.nameA} swings`}
                    value={compareCounts.a.confirmedSwings}
                  />
                  <CompareStat
                    label={`${compareCounts.nameB} swings`}
                    value={compareCounts.b.confirmedSwings}
                  />
                  <CompareStat
                    label={`${compareCounts.nameA} BOS`}
                    value={compareCounts.a.bullishBos + compareCounts.a.bearishBos}
                  />
                  <CompareStat
                    label={`${compareCounts.nameB} BOS`}
                    value={compareCounts.b.bullishBos + compareCounts.b.bearishBos}
                  />
                  <CompareStat
                    label={`${compareCounts.nameA} CHoCH`}
                    value={compareCounts.a.bullishChoch + compareCounts.a.bearishChoch}
                  />
                  <CompareStat
                    label={`${compareCounts.nameB} CHoCH`}
                    value={compareCounts.b.bullishChoch + compareCounts.b.bearishChoch}
                  />
                  <CompareStat
                    label={`${compareCounts.nameA} FVG`}
                    value={compareCounts.a.bullishFvg + compareCounts.a.bearishFvg}
                  />
                  <CompareStat
                    label={`${compareCounts.nameB} FVG`}
                    value={compareCounts.b.bullishFvg + compareCounts.b.bearishFvg}
                  />
                  <CompareStat
                    label={`${compareCounts.nameA} Sweeps`}
                    value={compareCounts.a.liquiditySweeps}
                  />
                  <CompareStat
                    label={`${compareCounts.nameB} Sweeps`}
                    value={compareCounts.b.liquiditySweeps}
                  />
                  <CompareStat
                    label={`${compareCounts.nameA} OB`}
                    value={compareCounts.a.orderBlocks}
                  />
                  <CompareStat
                    label={`${compareCounts.nameB} OB`}
                    value={compareCounts.b.orderBlocks}
                  />
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
        </div>
      </Disclosure>

      {/* Visibility: density + intelligence + smart visibility + zone lifecycle */}
      <Disclosure title="Visibility">
        <div className="space-y-4">
          <SmcControlsPanel {...sharedControls} sections={['density']} />

          {/* Intelligence visibility */}
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
                    onClick={() => handleVisibilityMode(id as SmcVisibilityModePref)}
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

          {/* Smart chart visibility */}
          <Card hover={false}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Smart chart visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Zone lifecycle projection only — detector events stay intact. Orthogonal to ranking
                Focus / Balanced / Debug.
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['active-only', 'Active Only', 'Untouched zones + current structure'],
                    ['setup-focus', 'Setup Focus', 'Selected setup event chain'],
                    ['balanced', 'Balanced', 'Active + recent (default)'],
                    ['history', 'History', 'Finished zones faded & clipped'],
                    ['debug', 'Debug', 'All lifecycle projections'],
                  ] as const
                ).map(([id, label, hint]) => (
                  <button
                    key={id}
                    type="button"
                    className={`min-h-11 rounded-lg border px-3 text-left text-sm ${
                      smartVisibilityPreset === id
                        ? 'border-sky-500/50 bg-sky-500/15'
                        : 'border-border bg-white/[0.03]'
                    }`}
                    onClick={() => handleSmartVisibilityPreset(id)}
                  >
                    <span className="font-medium">{label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
              {setupContext ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px]">
                  <span>
                    Setup focus · {setupContext.setupId} · {setupContext.direction} ·{' '}
                    {setupContext.status}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={exitSetupFocus}>
                    Exit setup focus
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => handleSmartVisibilityPreset('setup-focus')}
                >
                  Enter mock setup focus
                </Button>
              )}
              {/* Zone lifecycle settings */}
              <Disclosure title="Zone lifecycle settings">
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  {(
                    [
                      ['showActive', 'Show active'],
                      ['showTouched', 'Show touched'],
                      ['showMitigatedFilled', 'Show mitigated/filled'],
                      ['showInvalidated', 'Show invalidated'],
                      ['extendActiveZonesRight', 'Extend active zones right'],
                      ['fadeOldActiveZones', 'Fade old active zones'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={zoneLifecycle[key]}
                        onChange={(e) =>
                          setZoneLifecycle((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Disclosure>
              <p className="font-mono text-[11px] text-muted-foreground">
                Zones {lifecycleProjection.visibleZones.length}/{lifecycleProjection.zones.length} ·
                projection {lifecycleProjection.diagnostics.status}
              </p>
            </CardContent>
          </Card>
        </div>
      </Disclosure>

      {/* Modules */}
      <Disclosure title="Modules">
        <SmcControlsPanel {...sharedControls} sections={['modules']} />
      </Disclosure>

      {/* Advanced */}
      <Disclosure title="Advanced">
        <SmcControlsPanel {...sharedControls} sections={['advanced', 'layers']} />
      </Disclosure>

      {/* Presets */}
      <Disclosure title="Presets">
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
                bumpSavedTick()
              }}
            >
              Save current
            </Button>
          </div>
        </div>
      </Disclosure>

      {/* Sticky apply bar on mobile when dirty */}
      {configDirty ? (
        <div className="sticky bottom-0 z-20 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <Button
            type="button"
            className="min-h-11 w-full"
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
      ) : null}
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
