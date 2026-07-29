import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { KpiCards } from '@/features/dashboard/KpiCards'
import { EquityCurveChart } from '@/features/dashboard/EquityCurveChart'
import { MonthlyPerformance } from '@/features/dashboard/MonthlyPerformance'
import { TradeDistribution } from '@/features/dashboard/TradeDistribution'
import { BestStrategyCard } from '@/features/dashboard/BestStrategyCard'
import { AiRecommendationPanel } from '@/features/dashboard/AiRecommendationPanel'
import { StrategyHealth } from '@/features/dashboard/StrategyHealth'
import { RecentBacktestsTable } from '@/features/dashboard/RecentBacktestsTable'
import { TradeHistoryTable } from '@/features/dashboard/TradeHistoryTable'
import { PortfolioPanel } from '@/features/dashboard/PortfolioPanel'
import { MarketContextPanel } from '@/features/dashboard/MarketContextPanel'
import { WatchlistPanel } from '@/features/dashboard/WatchlistPanel'
import { useDashboard } from '@/api/queries/dashboard'
import { useBacktestHistory } from '@/api/queries/backtests'
import { useBacktestStore } from '@/stores/backtest.store'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function DashboardPage() {
  const { data } = useDashboard()
  // Hydrate dashboard KPIs / history from persisted GET /backtests.
  useBacktestHistory()
  const isRunning = useBacktestStore((state) => state.isRunning)

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {!data.hasBacktest && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-3 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">No backtest results yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Run a backtest in Strategy Lab to populate KPIs, equity curve, and trade history.
              </p>
            </div>
            <Link to="/strategy-lab">
              <Button>
                <FlaskConical className="h-4 w-4 mr-2" />
                Open Strategy Lab
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {isRunning && (
        <Card>
          <CardContent className="py-4 text-xs text-muted-foreground">
            Backtest in progress. Dashboard metrics will refresh automatically when complete.
          </CardContent>
        </Card>
      )}

      <KpiCards metrics={data.kpis} />
      <EquityCurveChart data={data.equityCurve} />
      <MonthlyPerformance
        monthlyProfit={data.monthlyProfit}
        dailyHeatmap={data.dailyHeatmap}
        weeklySummary={data.weeklySummary}
      />
      <TradeDistribution
        winLoss={data.winLossDistribution}
        longShort={data.longShortDistribution}
        session={data.sessionDistribution}
        timeframe={data.timeframeDistribution}
        risk={data.riskDistribution}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BestStrategyCard strategy={data.bestStrategy} />
        <StrategyHealth metrics={data.strategyHealth} overallScore={data.overallHealthScore} />
      </div>
      <AiRecommendationPanel recommendation={data.aiRecommendation} />
      <RecentBacktestsTable data={data.recentBacktests} />
      <PortfolioPanel portfolio={data.portfolio} />
      <TradeHistoryTable data={data.tradeHistory} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MarketContextPanel context={data.marketContext} />
        <WatchlistPanel items={data.watchlist} />
      </div>
    </motion.div>
  )
}
