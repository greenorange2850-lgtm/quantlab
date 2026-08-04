import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  REPLAY_SPEEDS,
  type ReplayControllerState,
  type ReplaySpeedMultiplier,
} from '../replay-window'
import { cn } from '@/lib/utils'

interface ReplayControlsProps {
  state: ReplayControllerState
  candleCount: number
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  onStep: (steps: 1 | 10) => void
  onSpeedChange: (speed: ReplaySpeedMultiplier) => void
}

export function ReplayControls({
  state,
  candleCount,
  onPlay,
  onPause,
  onRestart,
  onStep,
  onSpeedChange,
}: ReplayControlsProps) {
  const atEnd = candleCount === 0 || (state.mode === 'replay' && state.cursorIndex >= candleCount - 1)
  const canStep = candleCount > 0 && !atEnd

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground">Replay Controls</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            Candle {Math.max(0, state.cursorIndex + 1)} / {candleCount}
          </p>
        </div>
        <Badge variant={state.mode === 'replay' ? 'accent' : 'outline'} className="capitalize">
          {state.mode}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Button
          type="button"
          className="min-h-11"
          disabled={state.playing || atEnd}
          onClick={onPlay}
        >
          <Play className="h-3.5 w-3.5" />
          Play
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!state.playing}
          onClick={onPause}
        >
          <Pause className="h-3.5 w-3.5" />
          Pause
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={onRestart}>
          <RotateCcw className="h-3.5 w-3.5" />
          Restart
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!canStep}
          onClick={() => onStep(1)}
        >
          <StepForward className="h-3.5 w-3.5" />
          Step +1
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!canStep}
          onClick={() => onStep(10)}
        >
          Step +10
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {REPLAY_SPEEDS.map((speed) => (
          <Button
            key={speed}
            type="button"
            variant={state.speed === speed ? 'default' : 'outline'}
            className={cn('min-h-11', state.speed !== speed && 'text-muted-foreground')}
            onClick={() => onSpeedChange(speed)}
          >
            {speed}x
          </Button>
        ))}
      </div>
    </div>
  )
}
