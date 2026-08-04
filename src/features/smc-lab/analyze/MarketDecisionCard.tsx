import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import type { SmcDowTheoryLayer } from '@/core/smc'
import type { SetupEngineResult, TradingSetup } from '@/core/setup'
import { buildMarketDecisionView, type MarketDecisionView } from './trader-language'

function sideClass(side: MarketDecisionView['side']): string {
  switch (side) {
    case 'BUY':
      return 'text-emerald-300'
    case 'SELL':
      return 'text-red-300'
    default:
      return 'text-amber-100'
  }
}

function phaseClass(phase: MarketDecisionView['phase']): string {
  switch (phase) {
    case 'ENTRY READY':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
    case 'WAIT FOR RETEST':
    case 'WATCHING':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-50'
    case 'INVALID':
    case 'EXPIRED':
      return 'border-red-500/40 bg-red-500/10 text-red-100'
    default:
      return 'border-border bg-white/[0.03] text-muted-foreground'
  }
}

interface MarketDecisionCardProps {
  result: SetupEngineResult | null
  dow: SmcDowTheoryLayer
  selectedSetup: TradingSetup | null
  onSelectSetup?: (setup: TradingSetup) => void
}

export function MarketDecisionCard({
  result,
  dow,
  selectedSetup,
  onSelectSetup,
}: MarketDecisionCardProps) {
  const view = buildMarketDecisionView(result, dow, selectedSetup)

  return (
    <Card hover={false} className="border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Market Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={`text-4xl font-semibold tracking-tight ${sideClass(view.side)}`}>
              {view.side}
            </p>
            <Badge variant="outline" className={`mt-2 ${phaseClass(view.phase)}`}>
              {view.phase}
            </Badge>
          </div>
          <div className="text-right text-[11px]">
            <p className="text-muted-foreground">Confidence</p>
            <p className="font-mono text-2xl text-foreground">
              {view.confidence != null ? `${view.confidence}%` : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Market</p>
            <p className="font-medium">{view.marketLabel}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Setup</p>
            <p className="font-medium">{view.setupLabel ?? 'None'}</p>
          </div>
        </div>

        {view.reasonRows.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Reason
            </p>
            <ul className="space-y-1.5 text-[12px]">
              {view.reasonRows.slice(0, 8).map((row) => (
                <li key={row.technicalName} className="flex items-start gap-2">
                  <span className={row.passed ? 'text-emerald-300' : 'text-red-300'}>
                    {row.passed ? '✓' : '✗'}
                  </span>
                  <span className={row.passed ? 'text-foreground' : 'text-muted-foreground'}>
                    {row.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {view.stillWaiting.length > 0 && view.phase !== 'ENTRY READY' ? (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Still waiting because
            </p>
            <ul className="space-y-1.5 text-[12px]">
              {view.stillWaiting.slice(0, 5).map((item) => (
                <li key={item} className="flex items-start gap-2 text-amber-50/90">
                  <span className="text-red-300">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-lg border border-border/70 bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Next action</p>
          <p className="mt-1 text-[13px] text-foreground">{view.nextAction}</p>
        </div>

        {view.setup && onSelectSetup ? (
          <button
            type="button"
            className="text-[11px] text-sky-300 underline-offset-2 hover:underline"
            onClick={() => onSelectSetup(view.setup!)}
          >
            Focus this setup on the chart
          </button>
        ) : null}

        <Disclosure title="Show technical details" variant="plain">
          <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
            <p>Engine stance: {result?.summary.stance ?? 'n/a'}</p>
            <p>Setup id: {view.setup?.id ?? '—'}</p>
            <p>Setup type: {view.setup?.setupType ?? '—'}</p>
            <p>Status: {view.setup?.status ?? '—'}</p>
            <p>Strength score: {view.setup?.strength.score ?? '—'} (quality, not probability)</p>
            <p>Conflicts: {result?.conflicts.length ?? 0}</p>
            {view.reasonRows.map((row) => (
              <p key={`tech-${row.technicalName}`}>
                {row.technicalName}: {row.technicalReason}
              </p>
            ))}
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  )
}
