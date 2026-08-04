import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SetupEngineResult } from '@/core/setup'

interface SetupDiagnosticsPanelProps {
  result: SetupEngineResult | null
}

export function SetupDiagnosticsPanel({ result }: SetupDiagnosticsPanelProps) {
  const d = result?.diagnostics
  if (!d) {
    return (
      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Setup Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] text-muted-foreground">
          No setup evaluation yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm">Setup Diagnostics</CardTitle>
          <Badge variant="outline" className={d.ok ? 'text-emerald-300' : 'text-red-300'}>
            {d.ok ? 'invariants ok' : `${d.invariantFailures} failures`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        <div className="flex flex-wrap gap-3 font-mono text-muted-foreground">
          <span>Created {d.created}</span>
          <span>Watching {d.watching}</span>
          <span>Waiting {d.waitingRetest}</span>
          <span>Ready {d.ready}</span>
          <span>Completed {d.completed}</span>
          <span>Expired {d.expired}</span>
          <span>Invalidated {d.invalidated}</span>
        </div>
        <p className="font-mono text-muted-foreground">
          Avg strength {d.averageStrength} · conflicts {d.conflictCount} ·{' '}
          {d.durationMs.toFixed(1)}ms
        </p>
        {Object.keys(d.byType).length > 0 ? (
          <p className="font-mono text-[10px] text-muted-foreground">
            By type:{' '}
            {Object.entries(d.byType)
              .map(([k, v]) => `${k}=${v}`)
              .join(' · ')}
          </p>
        ) : null}
        {Object.keys(d.missingConditionCounts).length > 0 ? (
          <div>
            <p className="mb-1 text-[10px] uppercase text-muted-foreground">
              Missing condition counts
            </p>
            <ul className="font-mono text-[10px] text-muted-foreground">
              {Object.entries(d.missingConditionCounts).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {d.invariantDetails.length > 0 ? (
          <ul className="list-inside list-disc text-red-300">
            {d.invariantDetails.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
        {result?.conflicts.length ? (
          <div>
            <p className="mb-1 text-[10px] uppercase text-muted-foreground">Conflicts</p>
            <ul className="space-y-1 text-amber-100">
              {result.conflicts.map((c) => (
                <li key={c.id}>
                  {c.kind}: {c.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
