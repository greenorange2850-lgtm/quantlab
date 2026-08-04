import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SetupEngineResult, TradingSetup } from '@/core/setup'

function stanceClass(stance: SetupEngineResult['summary']['stance']): string {
  switch (stance) {
    case 'BUY READY':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
    case 'SELL READY':
      return 'bg-red-500/15 text-red-200 border-red-500/40'
    case 'WAIT':
      return 'bg-amber-500/15 text-amber-100 border-amber-500/40'
    default:
      return 'bg-white/5 text-muted-foreground border-border'
  }
}

interface SetupSummaryCardProps {
  result: SetupEngineResult | null
  selectedSetupId: string | null
  onSelectSetup: (setup: TradingSetup) => void
}

export function SetupSummaryCard({
  result,
  selectedSetupId,
  onSelectSetup,
}: SetupSummaryCardProps) {
  const summary = result?.summary
  if (!summary) {
    return (
      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Setup Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] text-muted-foreground">
          Run detection to evaluate setups.
        </CardContent>
      </Card>
    )
  }

  const highest = summary.highestRanked

  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Setup Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={stanceClass(summary.stance)}>
            {summary.stance}
          </Badge>
          {summary.strength != null ? (
            <span className="font-mono text-muted-foreground">
              Strength {summary.strength}
            </span>
          ) : null}
          {summary.conflictCount > 0 ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-100">
              {summary.conflictCount} conflict
              {summary.conflictCount === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>

        <p className="text-[11px] text-muted-foreground">{summary.reason}</p>

        <div className="flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          <span>BUY READY {summary.buyReadyCount}</span>
          <span>SELL READY {summary.sellReadyCount}</span>
          <span>WAIT {summary.watchingCount + summary.waitingRetestCount}</span>
          <span>Invalid {summary.invalidatedCount}</span>
          <span>Expired {summary.expiredCount}</span>
        </div>

        {summary.missingConditions.length > 0 ? (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Missing Conditions
            </p>
            <ul className="list-inside list-disc text-[11px] text-muted-foreground">
              {summary.missingConditions.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {highest ? (
          <button
            type="button"
            className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] transition-colors ${
              selectedSetupId === highest.id
                ? 'border-amber-400/50 bg-amber-500/10'
                : 'border-border bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
            onClick={() => onSelectSetup(highest)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Highest Ranked</span>
              <Badge variant="outline">{highest.setupType}</Badge>
              <Badge variant="outline">{highest.status}</Badge>
              <span className="font-mono text-muted-foreground">
                {highest.strength.score}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{highest.reason}</p>
          </button>
        ) : null}

        {result && result.setups.length > 0 ? (
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {result.rankedSetupIds.map((id) => {
              const setup = result.setups.find((s) => s.id === id)
              if (!setup) return null
              return (
                <button
                  key={setup.id}
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[10px] ${
                    selectedSetupId === setup.id
                      ? 'border-amber-400/50 bg-amber-500/10'
                      : 'border-transparent hover:bg-white/[0.03]'
                  }`}
                  onClick={() => onSelectSetup(setup)}
                >
                  <span className="truncate">
                    {setup.setupType} · {setup.direction}
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {setup.status} · {setup.strength.score}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
