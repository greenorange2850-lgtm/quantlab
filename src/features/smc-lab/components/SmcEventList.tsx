import type { Candle } from '@/data/candles'
import type { SmcDetectionKind, SmcDetectionResult } from '@/core/smc'
import { listReviewableEvents } from '../event-counts'
import { getSmcEventDisplayValue } from '../event-display'
import type { SmcReviewRecord } from '../persistence/types'
import { flattenDetectionEvents } from '../review-summary'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type SmcEventFilter =
  | 'ALL'
  | 'SWINGS'
  | 'STRUCTURE'
  | 'BOS'
  | 'CHOCH'
  | 'DISPLACEMENT'
  | 'FVG'
  | 'EQUAL'
  | 'SWEEP'
  | 'OB'
  | SmcDetectionKind
  | 'UNREVIEWED'
  | 'CORRECT'
  | 'WRONG'

interface SmcEventListProps {
  detection: SmcDetectionResult
  candles?: Candle[]
  reviewsByEventId: Map<string, SmcReviewRecord>
  filter: SmcEventFilter
  selectedEventId: string | null
  onFilterChange: (filter: SmcEventFilter) => void
  onSelect: (eventId: string) => void
  /** When true (default), list unique reviewable events only. */
  reviewableOnly?: boolean
}

const FILTERS: { id: SmcEventFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'SWINGS', label: 'Swings' },
  { id: 'STRUCTURE', label: 'i/e Structure' },
  { id: 'BOS', label: 'BOS' },
  { id: 'CHOCH', label: 'CHoCH' },
  { id: 'DISPLACEMENT', label: 'Disp' },
  { id: 'FVG', label: 'FVG' },
  { id: 'EQUAL', label: 'EQH/EQL' },
  { id: 'SWEEP', label: 'Sweep' },
  { id: 'OB', label: 'OB' },
  { id: 'UNREVIEWED', label: 'Unreviewed' },
  { id: 'CORRECT', label: 'Correct' },
  { id: 'WRONG', label: 'Wrong' },
]

function kindLabel(kind: SmcDetectionKind): string {
  return kind.replaceAll('_', ' ')
}

function matchesModuleFilter(kind: SmcDetectionKind, filter: SmcEventFilter): boolean {
  switch (filter) {
    case 'SWINGS':
      return kind === 'SWING_HIGH' || kind === 'SWING_LOW'
    case 'STRUCTURE':
      return (
        kind === 'INTERNAL_SWING_HIGH' ||
        kind === 'INTERNAL_SWING_LOW' ||
        kind === 'EXTERNAL_SWING_HIGH' ||
        kind === 'EXTERNAL_SWING_LOW'
      )
    case 'BOS':
      return kind === 'BULLISH_BOS' || kind === 'BEARISH_BOS'
    case 'CHOCH':
      return kind === 'BULLISH_CHOCH' || kind === 'BEARISH_CHOCH'
    case 'DISPLACEMENT':
      return kind.includes('DISPLACEMENT')
    case 'FVG':
      return kind.includes('FVG')
    case 'EQUAL':
      return kind === 'EQUAL_HIGHS' || kind === 'EQUAL_LOWS'
    case 'SWEEP':
      return kind.includes('LIQUIDITY_SWEEP')
    case 'OB':
      return kind.includes('ORDER_BLOCK')
    default:
      return kind === filter
  }
}

export function SmcEventList({
  detection,
  candles = [],
  reviewsByEventId,
  filter,
  selectedEventId,
  onFilterChange,
  onSelect,
  reviewableOnly = true,
}: SmcEventListProps) {
  const events = (reviewableOnly ? listReviewableEvents(detection) : flattenDetectionEvents(detection)).sort(
    (a, b) => a.candleIndex - b.candleIndex,
  )

  const filtered = events.filter((event) => {
    const review = reviewsByEventId.get(event.id)
    if (filter === 'ALL') return true
    if (filter === 'UNREVIEWED') return !review
    if (filter === 'CORRECT') return review?.verdict === 'correct'
    if (filter === 'WRONG') return review?.verdict === 'wrong'
    return matchesModuleFilter(event.kind, filter)
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
            const display = getSmcEventDisplayValue(event, candles)
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
                  <p className="font-mono text-xs">{display.primary}</p>
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
