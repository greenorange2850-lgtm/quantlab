import type { SmcBosEvent, SmcDetectionKind, SmcSwingEvent } from '@/core/smc'
import type { SmcReviewRecord } from '../persistence/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type SmcEventFilter =
  | 'ALL'
  | SmcDetectionKind
  | 'UNREVIEWED'
  | 'CORRECT'
  | 'WRONG'

interface SmcEventListProps {
  swings: SmcSwingEvent[]
  bosEvents: SmcBosEvent[]
  reviewsByEventId: Map<string, SmcReviewRecord>
  filter: SmcEventFilter
  selectedEventId: string | null
  onFilterChange: (filter: SmcEventFilter) => void
  onSelect: (eventId: string) => void
}

const FILTERS: { id: SmcEventFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'SWING_HIGH', label: 'SH' },
  { id: 'SWING_LOW', label: 'SL' },
  { id: 'BULLISH_BOS', label: 'Bull BOS' },
  { id: 'BEARISH_BOS', label: 'Bear BOS' },
  { id: 'UNREVIEWED', label: 'Unreviewed' },
  { id: 'CORRECT', label: 'Correct' },
  { id: 'WRONG', label: 'Wrong' },
]

function kindLabel(kind: SmcDetectionKind): string {
  switch (kind) {
    case 'SWING_HIGH':
      return 'Swing High'
    case 'SWING_LOW':
      return 'Swing Low'
    case 'BULLISH_BOS':
      return 'Bullish BOS'
    case 'BEARISH_BOS':
      return 'Bearish BOS'
  }
}

export function SmcEventList({
  swings,
  bosEvents,
  reviewsByEventId,
  filter,
  selectedEventId,
  onFilterChange,
  onSelect,
}: SmcEventListProps) {
  const events = [...swings, ...bosEvents].sort((a, b) => a.candleIndex - b.candleIndex)

  const filtered = events.filter((event) => {
    const review = reviewsByEventId.get(event.id)
    if (filter === 'ALL') return true
    if (filter === 'UNREVIEWED') return !review
    if (filter === 'CORRECT') return review?.verdict === 'correct'
    if (filter === 'WRONG') return review?.verdict === 'wrong'
    return event.kind === filter
  })

  return (
    <div className="rounded-xl border border-border/70 bg-card">
      <div className="border-b border-border/60 px-3 py-2">
        <p className="text-sm font-medium">Detected Events</p>
        <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'shrink-0 rounded-md px-2 py-1 text-[10px] font-medium',
                filter === item.id
                  ? 'bg-accent/20 text-foreground'
                  : 'text-muted-foreground hover:bg-white/[0.04]',
              )}
              onClick={() => onFilterChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-xs text-muted-foreground">No events for this filter.</li>
        ) : (
          filtered.map((event) => {
            const review = reviewsByEventId.get(event.id)
            const price =
              'price' in event ? event.price : (event as SmcBosEvent).closePrice
            return (
              <li key={event.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-white/[0.03]',
                    selectedEventId === event.id && 'bg-accent/10',
                  )}
                  onClick={() => onSelect(event.id)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">
                      {kindLabel(event.kind)}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                    {review ? (
                      <Badge
                        variant={review.verdict === 'correct' ? 'accent' : 'outline'}
                        className="ml-auto text-[9px] capitalize"
                      >
                        {review.verdict}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto text-[9px]">
                        unreviewed
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs">{price.toLocaleString()}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{event.reason}</p>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
