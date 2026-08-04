import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { Input } from '@/components/ui/input'
import { SmcValidationDashboard, SmcGoldenChartCompare } from '../validation'
import { SetupValidationPanel } from '../setup'
import { toDetectedProbes } from '@/core/smc'
import { getSmcLabStore } from '../persistence/smc-lab-store'
import { formatReviewedAccuracy } from '../review-summary'
import type { SmcManualAnnotation } from '../persistence/types'
import { useSmcLabWorkspace } from './SmcLabWorkspaceContext'

function WorkflowStep({ n, title }: { n: number; title: string }) {
  return (
    <p className="text-xs font-medium text-muted-foreground">
      <span className="mr-1 tabular-nums">{n}.</span>
      {title}
    </p>
  )
}

export function SmcValidateWorkspace() {
  const {
    detection,
    summary,
    moduleBuckets,
    goldenDatasets,
    activeGoldenId,
    setActiveGoldenId,
    validationReport,
    saveGoldenFromCorrectReviews,
    runValidation,
    deleteGoldenDataset,
    invariants,
    detectionComplete,
    annotations,
    setAnnotations,
    manualKind,
    setManualKind,
    manualPrice,
    setManualPrice,
    manualNote,
    setManualNote,
    addManualAnnotation,
    datasetKey,
    setupReviews,
    setupValidationMetrics,
  } = useSmcLabWorkspace()

  const noReviews = summary.overall.reviewed === 0

  return (
    <div
      id="smc-lab-panel-validate"
      role="tabpanel"
      aria-labelledby="smc-lab-tab-validate"
      className="space-y-4"
    >
      {/* Step 1: Review events */}
      <WorkflowStep n={1} title="Review events" />
      {noReviews ? (
        <Card hover={false}>
          <CardContent className="py-6 text-center text-[11px] text-muted-foreground">
            <p>No events reviewed yet.</p>
            <p className="mt-1">
              Switch to the <strong>Analyze</strong> tab, run detection, select events in the
              inspector, and mark them Correct / Wrong / Unsure.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Disclosure title="Review summary" defaultOpen>
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
      )}

      {/* Step 2: Save golden */}
      <WorkflowStep n={2} title="Save correct reviews as golden" />

      {/* Step 3: Select golden dataset */}
      <WorkflowStep n={3} title="Select golden dataset" />

      {/* Step 4: Run validation */}
      <WorkflowStep n={4} title="Run validation" />

      {/* Step 5: Precision / recall */}
      <WorkflowStep n={5} title="Inspect precision/recall" />
      <SmcValidationDashboard
        report={validationReport}
        datasets={goldenDatasets}
        activeDatasetId={activeGoldenId}
        onSelectDataset={setActiveGoldenId}
        onSaveGoldenFromReviews={saveGoldenFromCorrectReviews}
        onRunValidation={runValidation}
        onDeleteDataset={deleteGoldenDataset}
      />

      <WorkflowStep n={6} title="Setup Engine validation" />
      <SetupValidationPanel metrics={setupValidationMetrics} reviews={setupReviews} />

      {/* Golden chart compare */}
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

      {/* Step 6: Invariants */}
      <WorkflowStep n={6} title="Inspect invariants" />
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
              <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-4 text-danger">
                {detection.diagnostics.invariantDetails.slice(0, 20).map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card hover={false}>
          <CardContent className="py-4 text-center text-[11px] text-muted-foreground">
            Run detection to see invariant report.
          </CardContent>
        </Card>
      )}

      {/* Manual annotations */}
      <Disclosure title="Manual annotations">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="h-11 rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
              value={manualKind}
              onChange={(e) => setManualKind(e.target.value as SmcManualAnnotation['kind'])}
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
            <Button
              type="button"
              className="min-h-11"
              onClick={addManualAnnotation}
            >
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
    </div>
  )
}
