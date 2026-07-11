import { motion } from 'framer-motion'
import { KpiCards } from '@/features/dashboard/KpiCards'
import { EquityCurveChart } from '@/features/dashboard/EquityCurveChart'
import { MonthlyPerformance } from '@/features/dashboard/MonthlyPerformance'
import { TradeDistribution } from '@/features/dashboard/TradeDistribution'
import { BestStrategyCard } from '@/features/dashboard/BestStrategyCard'
import { AiRecommendationPanel } from '@/features/dashboard/AiRecommendationPanel'
import { StrategyHealth } from '@/features/dashboard/StrategyHealth'
import { RecentBacktestsTable } from '@/features/dashboard/RecentBacktestsTable'
import { MarketContextPanel } from '@/features/dashboard/MarketContextPanel'
import { WatchlistPanel } from '@/features/dashboard/WatchlistPanel'
import { useDashboard } from '@/api/queries/dashboard'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardPage() {
  const { data, isLoading, isError } = useDashboard()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        Failed to load dashboard data.
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MarketContextPanel context={data.marketContext} />
        <WatchlistPanel items={data.watchlist} />
      </div>
    </motion.div>
  )
}
