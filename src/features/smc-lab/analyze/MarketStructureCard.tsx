import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import type { SmcDowTheoryLayer } from '@/core/smc'
import type { DowChartVisibilityResult } from '../dow-visibility'
import {
  humanMarketTrend,
  preferredDirectionLabel,
  structureNarrative,
  trendConfidenceLabel,
} from './trader-language'

interface MarketStructureCardProps {
  dow: SmcDowTheoryLayer
  dowChartVisibility?: DowChartVisibilityResult
  onShowStructureView?: () => void
  onShowDebugView?: () => void
}

export function MarketStructureCard({
  dow,
  dowChartVisibility,
  onShowStructureView,
  onShowDebugView,
}: MarketStructureCardProps) {
  const market = humanMarketTrend(dow.trend)
  const confidence = trendConfidenceLabel(dow.strength)
  const preferred = preferredDirectionLabel(dow.trend)
  const lines = structureNarrative(dow)

  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Market Structure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-semibold tracking-tight">{market}</p>
          <Badge variant="outline">{confidence}</Badge>
        </div>

        <ul className="space-y-1 text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Trend confidence
          </p>
          <p className="font-medium">
            {confidence}
            <span className="ml-2 font-mono text-[11px] text-muted-foreground">
              {dow.strength}/100
            </span>
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Preferred direction
          </p>
          <p className="font-medium">{preferred}</p>
        </div>

        {dowChartVisibility?.notice ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
            <p>{dowChartVisibility.notice.message}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onShowStructureView ? (
                <button
                  type="button"
                  className="rounded-md border border-border bg-white/[0.04] px-2 py-1 text-[10px]"
                  onClick={onShowStructureView}
                >
                  Show clearer structure view
                </button>
              ) : null}
              {onShowDebugView ? (
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-[10px]"
                  onClick={onShowDebugView}
                >
                  Show full debug view
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <Disclosure title="Show technical details" variant="plain">
          <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
            <p>Phase: {dow.structurePhase}</p>
            <p>
              HH {dow.diagnostics.hhCount} · HL {dow.diagnostics.hlCount} · LH{' '}
              {dow.diagnostics.lhCount} · LL {dow.diagnostics.llCount}
            </p>
            {dowChartVisibility ? (
              <p>
                classified {dowChartVisibility.diagnostics.classifiedDowCount} · density{' '}
                {dowChartVisibility.diagnostics.densityEligibleDowCount} · ranking{' '}
                {dowChartVisibility.diagnostics.rankingVisibleDowCount} · chart{' '}
                {dowChartVisibility.diagnostics.chartRenderedDowCount}
              </p>
            ) : null}
            <p>Source: market-structure layer (engine metadata)</p>
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  )
}
