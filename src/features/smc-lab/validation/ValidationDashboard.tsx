import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  SmcGoldenDataset,
  SmcModuleValidationMetrics,
  SmcValidationReport,
} from '@/core/smc'

function pct(value: number | null): string {
  if (value == null) return 'n/a'
  return `${(value * 100).toFixed(1)}%`
}

function statusClass(status: SmcModuleValidationMetrics['status']): string {
  switch (status) {
    case 'Verified':
      return 'text-emerald-300'
    case 'Usable':
      return 'text-sky-300'
    case 'Needs Tuning':
      return 'text-amber-300'
    default:
      return 'text-muted-foreground'
  }
}

interface SmcValidationDashboardProps {
  report: SmcValidationReport | null
  datasets: SmcGoldenDataset[]
  activeDatasetId: string | null
  onSelectDataset: (id: string | null) => void
  onSaveGoldenFromReviews: () => void
  onRunValidation: () => void
  onDeleteDataset: (id: string) => void
  saving?: boolean
}

export function SmcValidationDashboard({
  report,
  datasets,
  activeDatasetId,
  onSelectDataset,
  onSaveGoldenFromReviews,
  onRunValidation,
  onDeleteDataset,
  saving = false,
}: SmcValidationDashboardProps) {
  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Validation Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="text-[11px] text-muted-foreground">
          Metrics use only reviewed / golden samples. Do not claim universal correctness.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="min-h-10"
            disabled={saving}
            onClick={onSaveGoldenFromReviews}
          >
            Save golden from correct reviews
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-10"
            onClick={onRunValidation}
          >
            Run validation
          </Button>
          <select
            className="h-10 min-w-[12rem] rounded-lg border border-border bg-white/[0.03] px-2 text-xs"
            value={activeDatasetId ?? ''}
            onChange={(e) => onSelectDataset(e.target.value || null)}
          >
            <option value="">Select golden dataset</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.labels.length} labels)
              </option>
            ))}
          </select>
          {activeDatasetId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-10"
              onClick={() => onDeleteDataset(activeDatasetId)}
            >
              Delete dataset
            </Button>
          ) : null}
        </div>

        {!report ? (
          <p className="text-muted-foreground">
            Save a golden dataset and run validation to see precision / recall by module.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Reviewed samples</p>
                <p className="font-mono">{report.reviewedSampleCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Detector version</p>
                <p className="font-mono text-[11px]">{report.detectorVersion}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Invariant failures</p>
                <p className="font-mono">{report.invariantFailures}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Worst module</p>
                <p className="font-mono">{report.worstModule ?? 'n/a'}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">Module</th>
                    <th className="py-1 pr-2 font-medium">TP</th>
                    <th className="py-1 pr-2 font-medium">FP</th>
                    <th className="py-1 pr-2 font-medium">FN</th>
                    <th className="py-1 pr-2 font-medium">Precision</th>
                    <th className="py-1 pr-2 font-medium">Recall</th>
                    <th className="py-1 pr-2 font-medium">Agreement</th>
                    <th className="py-1 pr-2 font-medium">Unsure</th>
                    <th className="py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.modules.map((m) => (
                    <tr key={m.module} className="border-b border-border/40">
                      <td className="py-1 pr-2">{m.module}</td>
                      <td className="py-1 pr-2 font-mono">{m.truePositives}</td>
                      <td className="py-1 pr-2 font-mono">{m.falsePositives}</td>
                      <td className="py-1 pr-2 font-mono">{m.falseNegatives}</td>
                      <td className="py-1 pr-2 font-mono">{pct(m.precision)}</td>
                      <td className="py-1 pr-2 font-mono">{pct(m.recall)}</td>
                      <td className="py-1 pr-2 font-mono">{pct(m.reviewedAgreement)}</td>
                      <td className="py-1 pr-2 font-mono">{m.unsureCount}</td>
                      <td className={`py-1 font-medium ${statusClass(m.status)}`}>{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1">
              <p className="font-medium">Most common wrong-reason tags</p>
              {report.wrongReasonTags.length === 0 ? (
                <p className="text-muted-foreground">None recorded</p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {report.wrongReasonTags.slice(0, 12).map((t) => (
                    <li key={t.tag}>
                      <Badge variant="outline" className="text-[10px]">
                        {t.tag} · {t.count}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {report.progressive ? (
              <div className="rounded-lg border border-border/60 bg-white/[0.02] p-2 font-mono text-[11px]">
                <p>
                  Progressive consistency:{' '}
                  {report.progressive.ok ? 'PASS' : 'FAIL'}
                </p>
                <p>
                  Full {report.progressive.fullHistoryEventCount} · Progressive final{' '}
                  {report.progressive.progressiveFinalEventCount}
                </p>
                <p>
                  Look-ahead violations: {report.progressive.lookAheadViolations.length}
                </p>
                {report.progressive.lookAheadViolations.slice(0, 5).map((v) => (
                  <p key={v.eventId} className="text-danger">
                    {v.detail}
                  </p>
                ))}
              </div>
            ) : null}

            <p className="text-[10px] text-muted-foreground">
              Config fingerprint: {report.configFingerprint.slice(0, 48)}…
              {report.profileId ? ` · profile ${report.profileId}` : ''}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
