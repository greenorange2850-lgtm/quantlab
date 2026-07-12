import { motion } from 'framer-motion'
import { Wallet, TrendingUp, Gauge, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import type { PortfolioSnapshot } from '@/types'

interface PortfolioPanelProps {
  portfolio: PortfolioSnapshot
}

export function PortfolioPanel({ portfolio }: PortfolioPanelProps) {
  const hasPositions = portfolio.positions.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <Card glow>
        <CardHeader>
          <CardTitle className="text-base">Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricTile
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Cash"
              value={portfolio.cash}
              format="currency"
            />
            <MetricTile
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Equity"
              value={portfolio.equity}
              format="currency"
            />
            <MetricTile
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="Buying Power"
              value={portfolio.buyingPower}
              format="currency"
            />
            <MetricTile
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Total Exposure"
              value={portfolio.totalExposure}
              format="currency"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-white/[0.02] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Realized PnL
              </p>
              <p
                className={cn(
                  'text-lg font-semibold font-mono',
                  portfolio.realizedPnL >= 0 ? 'text-success' : 'text-danger',
                )}
              >
                <AnimatedCounter value={portfolio.realizedPnL} prefix="$" decimals={2} />
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white/[0.02] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Unrealized PnL
              </p>
              <p
                className={cn(
                  'text-lg font-semibold font-mono',
                  portfolio.unrealizedPnL >= 0 ? 'text-success' : 'text-danger',
                )}
              >
                <AnimatedCounter value={portfolio.unrealizedPnL} prefix="$" decimals={2} />
              </p>
            </div>
          </div>

          {hasPositions ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Symbol', 'Qty', 'Market Value', 'Cost Basis', 'Unrealized', 'Realized', 'Weight'].map(
                      (header) => (
                        <th
                          key={header}
                          className="pb-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {portfolio.positions.map((position) => (
                    <tr key={position.symbol} className="border-b border-border/50">
                      <td className="py-2">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {position.symbol}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs font-mono">{position.quantity}</td>
                      <td className="py-2 text-xs font-mono">{formatCurrency(position.marketValue)}</td>
                      <td className="py-2 text-xs font-mono">{formatCurrency(position.costBasis)}</td>
                      <td
                        className={cn(
                          'py-2 text-xs font-mono',
                          position.unrealizedPnL >= 0 ? 'text-success' : 'text-danger',
                        )}
                      >
                        {formatCurrency(position.unrealizedPnL)}
                      </td>
                      <td className="py-2 text-xs font-mono">{formatCurrency(position.realizedPnL)}</td>
                      <td className="py-2 text-xs font-mono">{formatPercent(position.weight, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No open positions"
              description="Portfolio balances reflect the latest backtest account snapshot."
              className="py-8"
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function MetricTile({
  icon,
  label,
  value,
  format,
}: {
  icon: React.ReactNode
  label: string
  value: number
  format: 'currency'
}) {
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-semibold font-mono">
        {format === 'currency' ? (
          <AnimatedCounter value={value} prefix="$" decimals={2} />
        ) : (
          value
        )}
      </p>
    </div>
  )
}
