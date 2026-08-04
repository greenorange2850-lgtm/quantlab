import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Pause,
  Play,
} from 'lucide-react'

export type SmcPlaySpeed = 0.5 | 1 | 2 | 5

interface SmcCursorControlsProps {
  visibleIndex: number
  candleCount: number
  playing: boolean
  speed: SmcPlaySpeed
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  onPlay: () => void
  onPause: () => void
  onSpeedChange: (speed: SmcPlaySpeed) => void
}

const SPEEDS: SmcPlaySpeed[] = [0.5, 1, 2, 5]

export function SmcCursorControls({
  visibleIndex,
  candleCount,
  playing,
  speed,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onPlay,
  onPause,
  onSpeedChange,
}: SmcCursorControlsProps) {
  const atStart = visibleIndex <= 0
  const atEnd = candleCount === 0 || visibleIndex >= candleCount - 1

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Detector cursor</p>
        <Badge variant="outline" className="font-mono text-[10px]">
          Visible through {candleCount === 0 ? 0 : visibleIndex + 1} / {candleCount}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Button type="button" variant="outline" className="min-h-11" disabled={atStart} onClick={onFirst}>
          <ChevronsLeft className="h-3.5 w-3.5" />
          First
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={atStart} onClick={onPrev}>
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={atEnd} onClick={onNext}>
          <ChevronRight className="h-3.5 w-3.5" />
          Next
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={atEnd} onClick={onLast}>
          <ChevronsRight className="h-3.5 w-3.5" />
          Last
        </Button>
        {playing ? (
          <Button type="button" className="min-h-11" onClick={onPause}>
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
        ) : (
          <Button type="button" className="min-h-11" disabled={atEnd} onClick={onPlay}>
            <Play className="h-3.5 w-3.5" />
            Play
          </Button>
        )}
        <div className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border px-1">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded px-1.5 py-1 text-[10px] font-medium',
                speed === value ? 'bg-accent/20 text-foreground' : 'text-muted-foreground',
              )}
              onClick={() => onSpeedChange(value)}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Detector replay only — future candles and unconfirmed swings stay hidden. No trades or P&amp;L.
      </p>
    </div>
  )
}
