import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatPercent } from '@/lib/utils'
import type { WatchlistItem } from '@/types'

interface WatchlistPanelProps {
  items: WatchlistItem[]
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
