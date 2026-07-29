import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, List } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn, formatPercent } from '@/lib/utils'
import type { WatchlistItem } from '@/types'

interface WatchlistPanelProps {
  items: WatchlistItem[]
}

/** True when the watchlist contains real symbols (not an empty stub). */
export function hasWatchlistItems(items: WatchlistItem[] | null | undefined): boolean {
  return Array.isArray(items) && items.length > 0
}

const trendIcon = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  neutral: Minus,
  ranging: Minus,
}

const trendColor = {
  bullish: 'text-success',
  bearish: 'text-danger',
  neutral: 'text-muted',
  ranging: 'text-muted',
}

const signalVariant = {
  buy: 'success' as const,
  sell: 'danger' as const,
  hold: 'warning' as const,
  none: 'outline' as const,
}

export function WatchlistPanel({ items }: WatchlistPanelProps) {
  if (!hasWatchlistItems(items)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.65 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Watchlist</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<List className="h-6 w-6" />}
              title="No watchlist symbols yet."
              description="A live watchlist requires connected market data and saved symbols."
              action={
                <Link to="/market-explorer">
                  <Button size="sm" variant="outline">
                    Import market data
                  </Button>
                </Link>
              }
              className="py-8"
            />
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.65 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Watchlist</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {items.map((item, i) => {
              const TrendIcon = trendIcon[item.trend]
              return (
                <motion.div
                  key={item.symbol}
                  className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.05 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold font-mono w-16">{item.symbol}</span>
                    <span className="text-sm font-mono font-medium">
                      {item.price.toLocaleString('en-US', {
                        minimumFractionDigits: item.symbol.includes('JPY') ? 2 : item.price > 100 ? 1 : 4,
                        maximumFractionDigits: item.symbol.includes('JPY') ? 2 : item.price > 100 ? 1 : 4,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'text-xs font-mono font-medium',
                        item.dailyChange >= 0 ? 'text-success' : 'text-danger',
                      )}
                    >
                      {formatPercent(item.dailyChange)}
                    </span>
                    <TrendIcon className={cn('h-3.5 w-3.5', trendColor[item.trend])} />
                    <Badge variant={signalVariant[item.signal]} className="text-[10px] capitalize w-10 justify-center">
                      {item.signal}
                    </Badge>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
