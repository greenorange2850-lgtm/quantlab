import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { EquityCurveChart } from '@/features/dashboard/EquityCurveChart'
import { getBacktestDetail } from '@/backtests/detail-archive'
import type { EquityPoint } from '@/types'
import type { StrategyViewModel } from '@/strategies'

interface EquityTabProps {
  strategy: StrategyViewModel
}

function toChartPoints(
  curve: Array<{ time: number; equity: number; drawdown?: number }>,
): EquityPoint[] {
  return curve.map((point) => ({
    date: new Date(point.time).toISOString(),
    equity: Math.round(point.equity * 100) / 100,
    drawdown: Math.round((point.drawdown ?? 0) * 10000) / 100,
    buyHold: undefined,
  }))
}

export function EquityTab({ strategy }: EquityTabProps) {
  const chartData = useMemo(() => {
    const backtestId = strategy.bestBacktestId
    if (backtestId) {
      const detail = getBacktestDetail(backtestId)
      const full = detail?.report.equityCurve ?? []
      if (full.length > 2) return toChartPoints(full)
    }

    const slim =
      strategy.report.recommendedCandidate?.report.equityCurve ??
      strategy.report.bestCandidate?.report.equityCurve ??
      []
    if (slim.length === 0) return []
    return toChartPoints(slim)
  }, [strategy])

  if (chartData.length === 0) {
    return (
      <Card hover={false} className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Equity curve data is not available for this strategy.
        </CardContent>
      </Card>
    )
  }

  return <EquityCurveChart data={chartData} />
}
