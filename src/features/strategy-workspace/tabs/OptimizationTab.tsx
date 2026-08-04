import { OptimizationResultPanel } from '@/features/research-intelligence'
import type { StrategyViewModel } from '@/strategies'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface OptimizationTabProps {
  strategy: StrategyViewModel
  onContinueToReplay: () => void
}

export function OptimizationTab({ strategy, onContinueToReplay }: OptimizationTabProps) {
  if (!strategy.optimization && !strategy.report.bestCandidate) {
    return (
      <Card hover={false} className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No optimization summary is available for this strategy yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {strategy.optimization ? (
        <OptimizationResultPanel
          report={strategy.report}
          optimization={strategy.optimization}
        />
      ) : (
        <Card hover={false}>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Optimization completed with{' '}
            {strategy.report.candidatesEvaluated} candidates evaluated and{' '}
            {strategy.report.candidatesPassingConstraints} passing constraints.
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={onContinueToReplay}>
          Continue to Trade Replay
        </Button>
      </div>
    </div>
  )
}
