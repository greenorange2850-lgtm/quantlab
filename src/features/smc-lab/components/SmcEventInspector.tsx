import type { Candle } from '@/data/candles'
import type { SmcBosEvent, SmcSwingEvent } from '@/core/smc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { SmcReviewRecord, SmcWrongTag } from '../persistence/types'

const SWING_TAGS: { id: SmcWrongTag; label: string }[] = [
  { id: 'wrong_pivot', label: 'Wrong pivot' },
  { id: 'equal_handling', label: 'Equal high/low handling' },
  { id: 'confirmed_too_early', label: 'Confirmed too early' },
  { id: 'missed_stronger', label: 'Missed stronger swing' },
  { id: 'noise', label: 'Noise / insignificant' },
]

const BOS_TAGS: { id: SmcWrongTag; label: string }[] = [
  { id: 'wrong_swing', label: 'Wrong swing selected' },
  { id: 'wick_only', label: 'Wick break only' },
  { id: 'break_too_small', label: 'Break too small' },
  { id: 'repeated_break', label: 'Repeated break' },
  { id: 'structure_differs', label: 'Structure interpretation differs' },
  { id: 'other', label: 'Other' },
]

interface SmcEventInspectorProps {
  event: SmcSwingEvent | SmcBosEvent | null
  candles: Candle[]
  swings: SmcSwingEvent[]
  review: SmcReviewRecord | null
  reviewStale: boolean
  note: string
  tags: SmcWrongTag[]
  onNoteChange: (note: string) => void
  onTagsChange: (tags: SmcWrongTag[]) => void
  onVerdict: (verdict: 'correct' | 'wrong' | 'unsure') => void
  onResetReview: () => void
}

export function SmcEventInspector({
  event,
  candles,
  swings,
  review,
  reviewStale,
  note,
  tags,
  onNoteChange,
  onTagsChange,
  onVerdict,
  onResetReview,
}: SmcEventInspectorProps) {
  if (!event) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
        Select an event to inspect detection reasons and mark Correct / Wrong.
      </div>
    )
  }

  const isSwing = event.kind === 'SWING_HIGH' || event.kind === 'SWING_LOW'
  const candle = candles[event.candleIndex]
  const wrongTags = isSwing ? SWING_TAGS : BOS_TAGS

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Event Inspector</h3>
        <Badge variant="outline" className="text-[10px]">
          {event.kind}
        </Badge>
        {review ? (
          <Badge variant="accent" className="text-[10px] capitalize">
            {review.verdict}
          </Badge>
        ) : null}
        {reviewStale ? (
          <Badge variant="outline" className="text-[10px] text-amber-300">
            Review from earlier config
          </Badge>
        ) : null}
      </div>

      {isSwing ? (
        <div className="space-y-1 text-xs">
          <p>
            <span className="text-muted-foreground">Candle: </span>
            {new Date(event.timestamp).toLocaleString()}
          </p>
          <p>
            <span className="text-muted-foreground">Price: </span>
            <span className="font-mono">{event.price}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Confirmed: </span>
            {new Date(event.confirmedAtTimestamp).toLocaleString()} (index{' '}
            {event.confirmedAtIndex})
          </p>
          <p>
            <span className="text-muted-foreground">Pivot: </span>
            left {event.leftBars} / right {event.rightBars}
          </p>
          {candle ? (
            <p className="text-muted-foreground">
              OHLC {candle.open} / {candle.high} / {candle.low} / {candle.close}
            </p>
          ) : null}
          <p className="text-pretty text-muted-foreground">{event.reason}</p>
        </div>
      ) : (
        (() => {
          const bos = event as SmcBosEvent
          const swing = swings.find((s) => s.id === bos.brokenSwingId)
          return (
            <div className="space-y-1 text-xs">
              <p className="font-medium">
                {bos.kind === 'BULLISH_BOS' ? 'Bullish' : 'Bearish'} BOS detected
              </p>
              <p>
                <span className="text-muted-foreground">Latest confirmed swing: </span>
                <span className="font-mono">{bos.brokenSwingPrice}</span>
                {swing ? ` (${swing.kind})` : ''}
              </p>
              <p>
                <span className="text-muted-foreground">Swing confirmed: </span>
                {new Date(bos.brokenSwingTimestamp).toLocaleString()}
              </p>
              <p>
                <span className="text-muted-foreground">Break candle: </span>
                {new Date(bos.timestamp).toLocaleString()}
              </p>
              <p>
                <span className="text-muted-foreground">Close: </span>
                <span className="font-mono">{bos.closePrice}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Wick H/L: </span>
                <span className="font-mono">
                  {bos.wickHigh} / {bos.wickLow}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Break amount: </span>
                <span className="font-mono">{bos.breakAmount}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Break: </span>
                <span className="font-mono">{bos.breakPercent.toFixed(4)}%</span>
              </p>
              <p>
                <span className="text-muted-foreground">Wick-only: </span>
                {bos.wickOnlyIgnored ? 'Yes' : 'No'}
              </p>
              <p className="text-pretty text-muted-foreground">{bos.reason}</p>
              <p className="font-medium text-emerald-300">Result: Valid {bos.kind.replace('_', ' ')}</p>
            </div>
          )
        })()
      )}

      <div className="space-y-2 border-t border-border/60 pt-3">
        <p className="text-xs font-medium">Manual validation</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="min-h-9" onClick={() => onVerdict('correct')}>
            Correct
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-9"
            onClick={() => onVerdict('wrong')}
          >
            Wrong
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9"
            onClick={() => onVerdict('unsure')}
          >
            Unsure
          </Button>
          <Button type="button" size="sm" variant="ghost" className="min-h-9" onClick={onResetReview}>
            Reset Review
          </Button>
        </div>
        <Input
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Optional note"
          className="bg-white/[0.03]"
        />
        <div className="flex flex-wrap gap-2">
          {wrongTags.map((tag) => {
            const active = tags.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                className={
                  active
                    ? 'rounded-md bg-accent/20 px-2 py-1 text-[10px]'
                    : 'rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground'
                }
                onClick={() =>
                  onTagsChange(
                    active ? tags.filter((t) => t !== tag.id) : [...tags, tag.id],
                  )
                }
              >
                {tag.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
