import { useMemo } from 'react'
import type { Trade } from '@/core/backtest/Trade'
import type { BacktestExecutionEvent } from '@/core/backtest/execution-events'
import type { Candle } from '@/data/candles'
import type { MovingAverageCrossParams } from '@/core/strategy/MovingAverageCrossStrategy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buildVerifyTradeNarrative } from '../signal-verification'

interface VerifyTradePanelProps {
  trade: Trade | null
  candles: Candle[]
  events: BacktestExecutionEvent[]
  strategyParams?: MovingAverageCrossParams | null
}

function NarrativeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
      <p className="mb-2 text-xs font-medium text-foreground">{title}</p>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={`${title}-${item}-${index}`} className="flex gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-[9px] text-accent-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 text-foreground/90">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function VerifyTradePanel({
  trade,
  candles,
  events,
  strategyParams,
}: VerifyTradePanelProps) {
  const narrative = useMemo(() => {
    if (!trade) return null
    return buildVerifyTradeNarrative({ trade, candles, events, strategyParams })
  }, [candles, events, strategyParams, trade])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Verify Trade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {narrative ? (
          <>
            <NarrativeList title="Entry narrative" items={narrative.entry} />
            <NarrativeList title="Exit narrative" items={narrative.exit} />
          </>
        ) : (
          <p className="rounded-lg border border-border/60 bg-white/[0.02] p-3 text-xs text-muted-foreground">
            Select a trade to show the entry and exit narrative.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
