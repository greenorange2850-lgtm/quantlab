import { Card, CardContent } from '@/components/ui/card'
import { SummaryCard } from '@/features/research-analysis/components/SummaryCard'
import { StrengthsCard } from '@/features/research-analysis/components/StrengthsCard'
import { WeaknessesCard } from '@/features/research-analysis/components/WeaknessesCard'
import { SuggestionsCard } from '@/features/research-analysis/components/SuggestionsCard'
import { RiskCard } from '@/features/research-analysis/components/RiskCard'
import { RatingCard } from '@/features/research-analysis/components/RatingCard'
import type { StrategyViewModel } from '@/strategies'

interface AiAnalysisTabProps {
  strategy: StrategyViewModel
}

export function AiAnalysisTab({ strategy }: AiAnalysisTabProps) {
  const analysis = strategy.report.analysis

  if (!analysis) {
    return (
      <Card hover={false} className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No AI analysis is available yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Narrative derived from historical backtest fields — research aid only, not investment
        advice.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <SummaryCard analysis={analysis} />
        </div>
        <StrengthsCard analysis={analysis} />
        <WeaknessesCard analysis={analysis} />
        <SuggestionsCard analysis={analysis} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <RiskCard analysis={analysis} />
          <RatingCard analysis={analysis} />
        </div>
      </div>
    </div>
  )
}
