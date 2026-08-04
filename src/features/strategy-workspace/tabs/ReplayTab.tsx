import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OpenReplayButton, isReplayAvailableForBacktest } from '@/features/backtest-replay'
import type { StrategyViewModel } from '@/strategies'

interface ReplayTabProps {
  strategy: StrategyViewModel
  onContinueToSave: () => void
  showSaveCta: boolean
}

export function ReplayTab({ strategy, onContinueToSave, showSaveCta }: ReplayTabProps) {
  const backtestId = strategy.bestBacktestId
  const available = backtestId ? isReplayAvailableForBacktest(backtestId) : false

  return (
    <div className="space-y-4">
      <Card hover={false}>
        <CardHeader>
          <CardTitle className="text-base">Trade Replay validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Validate the winning parameters bar-by-bar before saving this strategy to your
            library. Random Search is complete — focus on whether the trades look sound.
          </p>
          {backtestId ? (
            <OpenReplayButton backtestId={backtestId} available={available} />
          ) : (
            <p className="text-xs text-muted-foreground">
              No backtest is linked to this strategy yet.
            </p>
          )}
          {!available && backtestId ? (
            <p className="text-xs text-muted-foreground">
              Full candle replay may be unavailable for older slim archives. Summary metrics
              and equity endpoints remain available on other tabs.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showSaveCta ? (
        <div className="flex justify-end">
          <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={onContinueToSave}>
            Continue to Save Strategy
          </Button>
        </div>
      ) : null}
    </div>
  )
}
