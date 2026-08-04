import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Disclosure } from '@/components/ui/disclosure'
import { SetupDiagnosticsPanel } from '../setup'
import { flattenDetectionEvents } from '../review-summary'
import { useSmcLabWorkspace } from './SmcLabWorkspaceContext'

export function SmcDiagnosticsWorkspace() {
  const {
    detection,
    progressiveVisible,
    windowCandles,
    windowStart,
    dowTheoryView,
    dowChartVisibility,
    lifecycleProjection,
    visibilityPipeline,
    invariants,
    detectionComplete,
    activeProfileId,
    exportResearch,
    importResearch,
    setupEngineResult,
  } = useSmcLabWorkspace()

  const s = detection.diagnostics.summary
  const b = detection.diagnostics.structureBreakCounts
  const sweep = detection.diagnostics.liquiditySweepDiagnostics
  const breakdown = detection.diagnostics.eventCountBreakdown

  return (
    <div
      id="smc-lab-panel-diagnostics"
      role="tabpanel"
      aria-labelledby="smc-lab-tab-diagnostics"
      className="space-y-3"
    >
      {/* Developer banner */}
      <div className="rounded-lg border border-border/60 bg-white/[0.02] px-4 py-2 text-[11px] text-muted-foreground">
        Developer diagnostics — not required for normal analysis.
      </div>

      {/* Status summary */}
      <Disclosure title="Status summary" defaultOpen>
        <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3 font-mono text-[11px] leading-relaxed">
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
          <p className="mt-2">Detector {detection.diagnostics.detectorVersion}</p>
          <p>Status {detection.diagnostics.detectionStatus}</p>
          <p>Structure {detection.structureState}</p>
          <p>Profile {activeProfileId}</p>
        </div>
      </Disclosure>

      {/* Invariant failures */}
      <Disclosure title="Invariant failures" defaultOpen>
        {invariants ? (
          <div className="space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <p>Invalid bullish BOS: {invariants.invalidBullishBosCount}</p>
              <p>Invalid bearish BOS: {invariants.invalidBearishBosCount}</p>
              <p>BOS before confirmation: {invariants.bosBeforeConfirmationCount}</p>
              <p>Duplicate break of same swing: {invariants.repeatedSwingBreakCount}</p>
              <p>BOS+CHoCH same swing: {invariants.duplicateBreakOfSameSwingCount}</p>
              <p>
                CHoCH without opposing structure: {invariants.chochWithoutPriorStructureCount}
              </p>
              <p>Invalid bullish CHoCH: {invariants.invalidBullishChochCount}</p>
              <p>Invalid bearish CHoCH: {invariants.invalidBearishChochCount}</p>
              <p>Invalid FVG geometry: {invariants.fvgInvalidGeometryCount}</p>
              <p>Sweep without penetration: {invariants.sweepWithoutPenetrationCount}</p>
              <p>Sweep without close reclaim: {invariants.sweepWithoutCloseReclaimCount}</p>
              <p>
                Repeated consumed-level sweep: {invariants.repeatedConsumedLevelSweepCount}
              </p>
              <p>Order Block after source break: {invariants.orderBlockAfterSourceBreakCount}</p>
              <p>Missing dependency reference: {invariants.dependencyReferenceMissingCount}</p>
              <p>Event timestamp mismatch: {invariants.eventTimestampMismatchCount}</p>
              <p>Artificial zero display value: {invariants.artificialZeroDisplayValueCount}</p>
              <p className="font-medium">
                Status:{' '}
                {detectionComplete && invariants.ok ? 'COMPLETE (0 failures)' : 'FAILED'}
              </p>
            </div>
            {!invariants.ok && detection.diagnostics.invariantDetails?.length ? (
              <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-4 text-danger text-[11px]">
                {detection.diagnostics.invariantDetails.slice(0, 20).map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No invariant data — run detection first.</p>
        )}
      </Disclosure>

      {/* Performance summary */}
      <Disclosure title="Performance summary" defaultOpen>
        <div className="space-y-1 font-mono text-[11px]">
          <p>Duration {detection.diagnostics.computationDurationMs.toFixed(1)} ms</p>
          {detection.diagnostics.moduleTimings.map((t) => (
            <p key={t.module}>
              {t.module}: {t.status} ({t.durationMs.toFixed(1)} ms)
            </p>
          ))}
        </div>
      </Disclosure>

      {/* Detector diagnostics / module counts */}
      <Disclosure title="Detector diagnostics / module counts">
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
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
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{breakdown.explanation}</p>
      </Disclosure>

      {/* Visibility pipeline */}
      <Disclosure title="Visibility pipeline">
        <div className="space-y-1 font-mono text-[11px]">
          <p>
            Overall detector {visibilityPipeline.overall.detectorCount} · ranked{' '}
            {visibilityPipeline.overall.rankedCount} · visible{' '}
            {visibilityPipeline.overall.visibleCount} · chartRendered{' '}
            {visibilityPipeline.overall.chartRenderedCount} · listRendered{' '}
            {visibilityPipeline.overall.listRenderedCount}
          </p>
          {(
            [
              'BOS',
              'CHoCH',
              'LiquiditySweep',
              'Swing',
              'Displacement',
              'FVG',
              'OrderBlock',
            ] as const
          ).map((module) => {
            const row = visibilityPipeline.byModule[module]
            if (row.detectorCount === 0 && row.visibleCount === 0) return null
            return (
              <p key={module}>
                {module}: detector {row.detectorCount} · ranked {row.rankedCount} · visible{' '}
                {row.visibleCount} · chart {row.chartRenderedCount} · list{' '}
                {row.listRenderedCount}
              </p>
            )
          })}
          {visibilityPipeline.notes.map((note) => (
            <p key={note} className="text-amber-200">
              {note}
            </p>
          ))}
        </div>
      </Disclosure>

      {/* Ranking diagnostics */}
      <Disclosure title="Ranking diagnostics">
        {detection.diagnostics.ranking ? (
          <div className="space-y-1 font-mono text-[11px]">
            <p>Detected Events: {detection.diagnostics.ranking.detectedEvents}</p>
            <p>Visible Events: {detection.diagnostics.ranking.visibleEvents}</p>
            <p>Hidden by Ranking: {detection.diagnostics.ranking.hiddenByRanking}</p>
            <p>Average Importance: {detection.diagnostics.ranking.averageImportance}</p>
            <p>Highest Importance: {detection.diagnostics.ranking.highestImportance}</p>
            <p>Lowest Importance: {detection.diagnostics.ranking.lowestImportance}</p>
            <p>Visibility mode: {detection.diagnostics.ranking.mode}</p>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No ranking data — run detection first.</p>
        )}
      </Disclosure>

      {/* Zone lifecycle diagnostics */}
      <Disclosure title="Zone lifecycle diagnostics">
        <div className="space-y-1 font-mono text-[11px]">
          <p>Status: {lifecycleProjection.diagnostics.status}</p>
          <p className="mt-1 font-medium text-foreground/80">Lifecycle report</p>
          <p>
            Zones Created {lifecycleProjection.lifecycleReport.zonesCreated} · Active{' '}
            {lifecycleProjection.lifecycleReport.active} · Touched{' '}
            {lifecycleProjection.lifecycleReport.touched} · Partial{' '}
            {lifecycleProjection.lifecycleReport.partial} · Mitigated{' '}
            {lifecycleProjection.lifecycleReport.mitigated} · Invalidated{' '}
            {lifecycleProjection.lifecycleReport.invalidated} · Expired{' '}
            {lifecycleProjection.lifecycleReport.expired}
          </p>
          <p>
            Sweeped {lifecycleProjection.lifecycleReport.sweeped} · Consumed{' '}
            {lifecycleProjection.lifecycleReport.consumed} · Average Lifetime{' '}
            {lifecycleProjection.lifecycleReport.averageLifetimeCandles} candles
          </p>
          <p>
            FVG active {lifecycleProjection.diagnostics.fvgActiveUntouched} · touched{' '}
            {lifecycleProjection.diagnostics.fvgTouched} · partial{' '}
            {lifecycleProjection.diagnostics.fvgPartiallyMitigated} · filled{' '}
            {lifecycleProjection.diagnostics.fvgFilled} · invalidated{' '}
            {lifecycleProjection.diagnostics.fvgInvalidated} · hidden{' '}
            {lifecycleProjection.diagnostics.fvgHiddenByVisibility}
          </p>
          <p>
            OB fresh {lifecycleProjection.diagnostics.obFresh} · touched{' '}
            {lifecycleProjection.diagnostics.obTouched} · partial{' '}
            {lifecycleProjection.diagnostics.obPartial} · mitigated{' '}
            {lifecycleProjection.diagnostics.obMitigated} · invalidated{' '}
            {lifecycleProjection.diagnostics.obInvalidated} · hidden{' '}
            {lifecycleProjection.diagnostics.obHiddenByVisibility}
          </p>
          <p>
            Liquidity unswept {lifecycleProjection.diagnostics.liquidityActiveUnswept} · swept{' '}
            {lifecycleProjection.diagnostics.liquiditySwept} · broken{' '}
            {lifecycleProjection.diagnostics.liquidityBroken} · superseded{' '}
            {lifecycleProjection.diagnostics.liquiditySuperseded}
          </p>
          <p>
            Extending {lifecycleProjection.diagnostics.zonesExtendingToVisibleIndex} · clipped{' '}
            {lifecycleProjection.diagnostics.zonesClippedAtTerminal} · setup-forced{' '}
            {lifecycleProjection.diagnostics.setupForcedVisible} · hidden by lifecycle{' '}
            {lifecycleProjection.diagnostics.hiddenByLifecycle}
          </p>
          <p>
            Invariants: filledFvgPastFill=
            {lifecycleProjection.diagnostics.invariants.filledFvgExtendingPastFill} ·
            invFvgPast=
            {lifecycleProjection.diagnostics.invariants.invalidatedFvgExtendingPastInvalidation}{' '}
            · mitigatedObActive=
            {lifecycleProjection.diagnostics.invariants.mitigatedObRenderedActive} · invObRight=
            {lifecycleProjection.diagnostics.invariants.invalidatedObExtendingRight} · sweptPast=
            {lifecycleProjection.diagnostics.invariants.sweptLiquidityExtendingPastSweep} ·
            brokenActive=
            {lifecycleProjection.diagnostics.invariants.brokenLiquidityRenderedActive} ·
            setupHidden=
            {lifecycleProjection.diagnostics.invariants.setupReferencedHidden}
          </p>
          {lifecycleProjection.diagnostics.invariantDetails.slice(0, 8).map((d) => (
            <p key={d} className="text-danger">
              {d}
            </p>
          ))}
        </div>
      </Disclosure>

      {/* Setup Engine diagnostics */}
      <Disclosure title="Setup Engine diagnostics" defaultOpen>
        <SetupDiagnosticsPanel result={setupEngineResult} />
      </Disclosure>

      {/* QML diagnostics */}
      <Disclosure title="QML diagnostics">
        <div className="space-y-1 font-mono text-[11px]">
          {detection.qml ? (
            <>
              <p>
                status {detection.qml.status} · experimental {String(detection.qml.experimental)} ·
                enabled {String(detection.qml.enabled)}
              </p>
              <p>
                candidates {detection.qml.diagnostics.structuralCandidates} · bull{' '}
                {detection.qml.diagnostics.confirmedBullish} · bear{' '}
                {detection.qml.diagnostics.confirmedBearish} · active{' '}
                {detection.qml.diagnostics.activeZones} · retested{' '}
                {detection.qml.diagnostics.retested} · ready {detection.qml.diagnostics.entryReady}{' '}
                · invalid {detection.qml.diagnostics.invalidated} · expired{' '}
                {detection.qml.diagnostics.expired}
              </p>
              <p>
                duplicates suppressed {detection.qml.diagnostics.duplicatePatternsSuppressed} ·
                avg strength {detection.qml.diagnostics.averageStrength.toFixed(1)} · avg bars to
                retest{' '}
                {detection.qml.diagnostics.averageBarsFromChochToRetest?.toFixed(1) ?? '—'}
              </p>
              <p>
                internal sources {detection.qml.diagnostics.internalSourceCount} · external{' '}
                {detection.qml.diagnostics.externalSourceCount} · duration{' '}
                {detection.qml.diagnostics.durationMs.toFixed(1)}ms
              </p>
              <p>
                invariants ok={String(detection.qml.invariants.ok)} · withoutPrior=
                {detection.qml.invariants.qmlWithoutPriorTrend} · srcAfterExt=
                {detection.qml.invariants.sourceSwingAfterExtreme} · extAfterChoch=
                {detection.qml.invariants.extremeAfterChoch} · retestBefore=
                {detection.qml.invariants.retestBeforeZoneCreation} · entryBefore=
                {detection.qml.invariants.entryReadyBeforeRetestClose} · dup=
                {detection.qml.invariants.duplicateCanonicalQml} · future=
                {detection.qml.invariants.futureEventUsed}
              </p>
              {detection.qml.invariantDetails.slice(0, 8).map((d) => (
                <p key={d} className="text-danger">
                  {d}
                </p>
              ))}
              {detection.qml.diagnostics.candidatesRejectedByReason.slice(0, 8).map((r) => (
                <p key={r.reason}>
                  rejected {r.reason}: {r.count}
                </p>
              ))}
            </>
          ) : (
            <p>QML layer not present (module disabled or not run).</p>
          )}
        </div>
      </Disclosure>

      {/* Dow diagnostics */}
      <Disclosure title="Dow diagnostics">
        <div className="space-y-1 font-mono text-[11px]">
          <p>
            result.dowTheory: {detection.dowTheory ? 'populated' : 'missing'} · progressive
            labels {Object.keys(dowTheoryView.swingClassification).length}
          </p>
          <p>
            Trend {dowTheoryView.trend} · strength {dowTheoryView.strength} · phase{' '}
            {dowTheoryView.structurePhase}
          </p>
          <p>
            HH {dowTheoryView.diagnostics.hhCount} · HL {dowTheoryView.diagnostics.hlCount} · LH{' '}
            {dowTheoryView.diagnostics.lhCount} · LL {dowTheoryView.diagnostics.llCount}
          </p>
          <p>Dow visibility diagnostics:</p>
          <p>
            classified {dowChartVisibility.diagnostics.classifiedDowCount} · density eligible{' '}
            {dowChartVisibility.diagnostics.densityEligibleDowCount} · ranking visible{' '}
            {dowChartVisibility.diagnostics.rankingVisibleDowCount} · chart rendered{' '}
            {dowChartVisibility.diagnostics.chartRenderedDowCount}
          </p>
          <p>
            hidden by density {dowChartVisibility.diagnostics.hiddenByDensity} · hidden by ranking{' '}
            {dowChartVisibility.diagnostics.hiddenByRanking}
          </p>
        </div>
      </Disclosure>

      {/* Raw event counts */}
      <Disclosure title="Raw event counts">
        <div className="space-y-1 font-mono text-[11px]">
          <p>External swings: {s.externalSwings}</p>
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
      </Disclosure>

      {/* Projection invariants */}
      <Disclosure title="Projection invariants">
        <div className="space-y-1 font-mono text-[11px]">
          <p>
            filledFvgExtendingPastFill:{' '}
            {lifecycleProjection.diagnostics.invariants.filledFvgExtendingPastFill}
          </p>
          <p>
            invalidatedFvgExtendingPastInvalidation:{' '}
            {
              lifecycleProjection.diagnostics.invariants
                .invalidatedFvgExtendingPastInvalidation
            }
          </p>
          <p>
            mitigatedObRenderedActive:{' '}
            {lifecycleProjection.diagnostics.invariants.mitigatedObRenderedActive}
          </p>
          <p>
            invalidatedObExtendingRight:{' '}
            {lifecycleProjection.diagnostics.invariants.invalidatedObExtendingRight}
          </p>
          <p>
            sweptLiquidityExtendingPastSweep:{' '}
            {lifecycleProjection.diagnostics.invariants.sweptLiquidityExtendingPastSweep}
          </p>
          <p>
            brokenLiquidityRenderedActive:{' '}
            {lifecycleProjection.diagnostics.invariants.brokenLiquidityRenderedActive}
          </p>
          <p>
            setupReferencedHidden:{' '}
            {lifecycleProjection.diagnostics.invariants.setupReferencedHidden}
          </p>
        </div>
      </Disclosure>

      {/* Developer import/export */}
      <Disclosure title="Developer import/export data">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={exportResearch}
          >
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
