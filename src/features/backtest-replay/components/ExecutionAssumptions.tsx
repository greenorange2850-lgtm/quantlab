import { EXECUTION_ASSUMPTIONS } from '@/core/backtest/execution-events'
import { Disclosure } from '@/components/ui/disclosure'

const labels: Record<keyof typeof EXECUTION_ASSUMPTIONS, string> = {
  signalTiming: 'Signal timing',
  fillModel: 'Fill model',
  feeModel: 'Fee model',
  slippageModel: 'Slippage model',
  positionModel: 'Position model',
  stopLossModel: 'Stop-loss model',
  takeProfitModel: 'Take-profit model',
}

export function ExecutionAssumptions() {
  return (
    <Disclosure title="Execution Assumptions">
      <div className="space-y-2">
        {Object.entries(EXECUTION_ASSUMPTIONS).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {labels[key as keyof typeof EXECUTION_ASSUMPTIONS]}
            </p>
            <p className="mt-1 text-xs text-foreground">{value}</p>
          </div>
        ))}
      </div>
    </Disclosure>
  )
}
