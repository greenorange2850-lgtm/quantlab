import { motion } from 'framer-motion'
import {
  Newspaper,
  Gauge,
  Activity,
  Calendar,
  Droplets,
  Clock,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import type { MarketContext } from '@/types'

interface MarketContextPanelProps {
  context: MarketContext
}

export function MarketContextPanel({ context }: MarketContextPanelProps) {
  const sentimentLabel =
    context.newsSentiment >= 60 ? 'Bullish' : context.newsSentiment >= 40 ? 'Neutral' : 'Bearish'

  const fearGreedLabel =
    context.fearGreed >= 75
      ? 'Extreme Greed'
      : context.fearGreed >= 55
        ? 'Greed'
        : context.fearGreed >= 45
          ? 'Neutral'
          : context.fearGreed >= 25
            ? 'Fear'
            : 'Extreme Fear'

  const impactColor = { high: 'danger', medium: 'warning', low: 'outline' } as const

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Market Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0 rounded-lg border border-border bg-white/[0.02] p-3">
              <div className="mb-2 flex min-w-0 items-center gap-2">
                <Newspaper className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  News Sentiment
                </span>
              </div>
              <p className="text-lg font-semibold font-mono">
                <AnimatedCounter value={context.newsSentiment} suffix="%" />
              </p>
              <p className="text-[10px] text-muted mt-0.5">{sentimentLabel}</p>
              <Progress value={context.newsSentiment} className="mt-2" />
            </div>

            <div className="min-w-0 rounded-lg border border-border bg-white/[0.02] p-3">
              <div className="mb-2 flex min-w-0 items-center gap-2">
                <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  Fear & Greed
                </span>
              </div>
              <p className="text-lg font-semibold font-mono">
                <AnimatedCounter value={context.fearGreed} />
              </p>
              <p className="text-[10px] text-muted mt-0.5">{fearGreedLabel}</p>
              <Progress value={context.fearGreed} className="mt-2" />
            </div>

            <div className="min-w-0 rounded-lg border border-border bg-white/[0.02] p-3">
              <div className="mb-2 flex min-w-0 items-center gap-2">
                <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  Volatility
                </span>
              </div>
              <p className="text-lg font-semibold font-mono">
                <AnimatedCounter value={context.volatility} decimals={1} suffix="%" />
              </p>
              <p className="text-[10px] text-muted mt-0.5">VIX Equivalent</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Economic Calendar</span>
            </div>
            <div className="space-y-1.5">
              {context.upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex min-w-0 flex-col gap-2 rounded-md px-2.5 py-1.5 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="w-10 shrink-0 font-mono text-[10px] text-muted">{event.time}</span>
                    <span className="min-w-0 truncate text-xs">{event.event}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {event.currency}
                    </Badge>
                    <Badge variant={impactColor[event.impact]} className="text-[9px] capitalize">
                      {event.impact}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
            <div className="flex min-w-0 items-center gap-2">
              <Droplets className="h-3.5 w-3.5 shrink-0 text-success" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Liquidity</p>
                <p className="truncate text-xs font-medium capitalize">{context.liquidityStatus}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Session</p>
                <p className="text-xs font-medium">{context.marketSession}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Spread</p>
                <p className="truncate font-mono text-xs font-medium">{context.currentSpread} pips</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
