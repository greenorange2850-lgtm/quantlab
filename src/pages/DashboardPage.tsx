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
import { RestoredBacktestBanner } from '@/features/dashboard/RestoredBacktestBanner'
import { TradeHistoryTable } from '@/features/dashboard/TradeHistoryTable'
import { PortfolioPanel } from '@/features/dashboard/PortfolioPanel'
import { MarketContextPanel } from '@/features/dashboard/MarketContextPanel'
import { WatchlistPanel } from '@/features/dashboard/WatchlistPanel'
import { useDashboard } from '@/api/queries/dashboard'
import { useBacktestStore } from '@/stores/backtest.store'
import { shouldAwaitDashboardSessionHydrate } from '@/research/ui-gates'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'

function DashboardHydrateSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full min-w-0 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 min-w-0 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] w-full min-w-0 rounded-xl" />
    </div>
  )
}

export function DashboardPage() {
  const { data } = useDashboard()
  const isRunning = useBacktestStore((state) => state.isRunning)
  const restoredId = useBacktestStore((state) => state.restoredId)
  const isRestoring = useBacktestStore((state) => state.isRestoring)
  const isHydratingSession = useBacktestStore((state) => state.isHydratingSession)
  const hasAttemptedSessionHydrate = useBacktestStore(
    (state) => state.hasAttemptedSessionHydrate,
  )
  const sessionHydrateError = useBacktestStore((state) => state.sessionHydrateError)
  const restoreBacktest = useBacktestStore((state) => state.restoreBacktest)

  const handleViewDetails = (id: string) => {
    void restoreBacktest(id)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!data) {
    return <DashboardHydrateSkeleton />
  }

  // Never flash the empty CTA before startup hydrate finishes.
  if (
    shouldAwaitDashboardSessionHydrate({
      hasBacktest: data.hasBacktest,
      hasAttemptedSessionHydrate,
      isHydratingSession,
      sessionHydrateError,
    })
  ) {
    return (
      <div className="min-w-0 space-y-6">
        <RestoredBacktestBanner />
        <DashboardHydrateSkeleton />
      </div>
    )
  }

  const netProfitKpi = data.kpis.find((m) => m.id === 'net-profit')
  const netProfit =
    typeof netProfitKpi?.value === 'number' ? netProfitKpi.value : undefined

  return (
    <motion.div
      className="min-w-0 space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <RestoredBacktestBanner />

      {!data.hasBacktest && hasAttemptedSessionHydrate && !isHydratingSession && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-3 py-6 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-balance">No backtest yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Run one in Strategy Lab.</p>
            </div>
            <Link to="/strategy-lab" className="w-full shrink-0 md:w-auto">
              <Button className="min-h-11 w-full md:min-h-9 md:w-auto">
                <FlaskConical className="mr-2 h-4 w-4" />
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

      {/* First screen: good? / made? / risky? */}
      <KpiCards metrics={data.kpis} researchScore={data.overallHealthScore} />
      <EquityCurveChart data={data.equityCurve} />

      <Disclosure title="Strategy details">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <BestStrategyCard strategy={data.bestStrategy} netProfit={netProfit} />
          <StrategyHealth metrics={data.strategyHealth} overallScore={data.overallHealthScore} />
        </div>
      </Disclosure>

      <Disclosure title="Performance breakdown">
        <div className="space-y-4">
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
        </div>
      </Disclosure>

      <Disclosure title="History & portfolio">
        <div className="space-y-4">
          <AiRecommendationPanel recommendation={data.aiRecommendation} />
          <RecentBacktestsTable
            data={data.recentBacktests}
            onViewDetails={handleViewDetails}
            activeRestoredId={restoredId}
            isRestoring={isRestoring}
          />
          <PortfolioPanel portfolio={data.portfolio} />
          <TradeHistoryTable data={data.tradeHistory} />
        </div>
      </Disclosure>

      <Disclosure title="Market context">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <MarketContextPanel context={data.marketContext} />
          <WatchlistPanel items={data.watchlist} />
        </div>
      </Disclosure>
    </motion.div>
  )
}
