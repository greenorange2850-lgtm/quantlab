import { Activity, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { Progress } from '@/components/ui/progress'
import type { PlaybookDiagnostics, PlaybookHistoryResult } from '@/core/playbook'
import { STATUS_LABELS } from '@/core/playbook'

interface DiagnosticsPanelProps {
  diagnostics: PlaybookDiagnostics
  history: PlaybookHistoryResult
}

export function DiagnosticsPanel({ diagnostics, history }: DiagnosticsPanelProps) {
  const invariantFailures = diagnostics.invariantFailures ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Readies" value={history.readies} />
          <Metric label="Avg strength" value={history.averageStrength.toFixed(1)} />
          <Metric label="Max strength" value={history.maxStrength} />
          <Metric label="Evals" value={history.evaluations.length} />
          <Metric label="Duration" value={`${history.durationMs}ms`} />
          <Metric label="Events" value={history.evaluations[0]?.eventChain.length ?? 0} />
        </div>

        <Disclosure title="Status distribution">
          <div className="space-y-2">
            {(['READY', 'WAITING_RETEST', 'WATCHING', 'COMPLETED', 'INVALIDATED', 'EXPIRED'] as const).map(
              (status) => {
                const count = diagnostics.byStatus[status] ?? 0
                const total = Math.max(1, diagnostics.totalEvaluations)
                return (
                  <div key={status} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 truncate text-[11px] text-muted-foreground">
                      {STATUS_LABELS[status]}
                    </span>
                    <Progress value={(count / total) * 100} className="flex-1" />
                    <span className="w-8 shrink-0 text-right text-xs text-foreground">{count}</span>
                  </div>
                )
              },
            )}
          </div>
        </Disclosure>

        {Object.keys(diagnostics.missingConditions).length > 0 && (
          <Disclosure title="Most-blocked checks">
            <div className="space-y-1.5">
              {Object.entries(diagnostics.missingConditions)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([checkId, count]) => (
                  <div key={checkId} className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                      {checkId}
                    </span>
                    <span className="text-xs text-foreground">{count}</span>
                  </div>
                ))}
            </div>
          </Disclosure>
        )}

        {invariantFailures.length > 0 ? (
          <div className="rounded-lg border border-danger/20 bg-danger-muted px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-danger">
              <XCircle className="h-3.5 w-3.5" /> Invariant failures
            </div>
            {invariantFailures.map((f) => (
              <p key={f} className="font-mono text-[11px] text-danger/90">
                {f}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-muted px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="text-xs text-success">All invariants passed</span>
          </div>
        )}

        {diagnostics.strongest && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2 text-[11px] text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-accent" />
            Strongest: {STATUS_LABELS[diagnostics.strongest.status]} · strength{' '}
            {diagnostics.strongest.strength} · candle {diagnostics.strongest.candleIndex}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-foreground">{value}</div>
    </div>
  )
}
