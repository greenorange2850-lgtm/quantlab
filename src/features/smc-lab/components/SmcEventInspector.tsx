import type { ReactNode } from 'react'
import type { Candle } from '@/data/candles'
import type {
  SmcBosEvent,
  SmcChochEvent,
  SmcClassifiedSwingEvent,
  SmcDisplacementEvent,
  SmcEqualLevelEvent,
  SmcEvent,
  SmcEventRef,
  SmcFvgEvent,
  SmcLiquiditySweepEvent,
  SmcOrderBlockEvent,
  SmcSwingEvent,
} from '@/core/smc'
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
  { id: 'wrong_classification', label: 'Wrong classification' },
]

const BOS_TAGS: { id: SmcWrongTag; label: string }[] = [
  { id: 'wrong_swing', label: 'Wrong swing selected' },
  { id: 'wick_only', label: 'Wick break only' },
  { id: 'break_too_small', label: 'Break too small' },
  { id: 'repeated_break', label: 'Repeated break' },
  { id: 'structure_differs', label: 'Structure interpretation differs' },
  { id: 'wrong_choch', label: 'Wrong CHoCH' },
  { id: 'other', label: 'Other' },
]

const PHASE2_TAGS: { id: SmcWrongTag; label: string }[] = [
  { id: 'false_displacement', label: 'False displacement' },
  { id: 'bad_fvg_geometry', label: 'Bad FVG geometry' },
  { id: 'false_sweep', label: 'False sweep' },
  { id: 'bad_order_block', label: 'Bad Order Block' },
  { id: 'dependency_wrong', label: 'Dependency wrong' },
  { id: 'wrong_classification', label: 'Wrong classification' },
  { id: 'other', label: 'Other' },
]

interface SmcEventInspectorProps {
  event: SmcEvent | null
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

function isSwingKind(kind: string): boolean {
  return kind.includes('SWING')
}

function isBosKind(kind: string): boolean {
  return kind.includes('BOS') && !kind.includes('ORDER')
}

function isChochKind(kind: string): boolean {
  return kind.includes('CHOCH')
}

function tagsForEvent(kind: string): { id: SmcWrongTag; label: string }[] {
  if (isSwingKind(kind)) return SWING_TAGS
  if (isBosKind(kind) || isChochKind(kind)) return BOS_TAGS
  return PHASE2_TAGS
}

function eventChainFrom(event: SmcEvent): SmcEventRef[] {
  if ('eventChain' in event && Array.isArray(event.eventChain) && event.eventChain.length > 0) {
    return event.eventChain
  }
  if ('refs' in event && Array.isArray(event.refs)) {
    return event.refs
  }
  return []
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {children}
    </p>
  )
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
        Select an event to inspect detection reasons and mark Correct / Wrong / Unsure.
      </div>
    )
  }

  const candle = candles[event.candleIndex]
  const wrongTags = tagsForEvent(event.kind)
  const chain = eventChainFrom(event)

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
            Review from earlier config / profile
          </Badge>
        ) : null}
      </div>

      <div className="space-y-1 text-xs">{renderEventBody(event, candle, swings)}</div>

      {chain.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-border/60 bg-white/[0.02] p-2 text-xs">
          <p className="font-medium">Event Chain</p>
          <p className="text-[10px] text-muted-foreground">
            From detector refs / eventChain (not recomputed).
          </p>
          <ul className="mt-1 space-y-0.5">
            {chain.map((ref) => (
              <li key={`${ref.id}-${ref.kind}`} className="font-mono text-[10px]">
                {ref.kind} · {ref.id}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
                  onTagsChange(active ? tags.filter((t) => t !== tag.id) : [...tags, tag.id])
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

function renderEventBody(
  event: SmcEvent,
  candle: Candle | undefined,
  swings: SmcSwingEvent[],
): ReactNode {
  if (isSwingKind(event.kind)) {
    const swing = event as SmcSwingEvent | SmcClassifiedSwingEvent
    return (
      <>
        <Row label="Swing candle index">{swing.candleIndex}</Row>
        <Row label="Candle">{new Date(swing.timestamp).toLocaleString()}</Row>
        <Row label="Price">
          <span className="font-mono">{swing.price}</span>
        </Row>
        <Row label="Confirmation index">{swing.confirmedAtIndex}</Row>
        <Row label="Confirmed">{new Date(swing.confirmedAtTimestamp).toLocaleString()}</Row>
        <Row label="Pivot">
          left {swing.leftBars} / right {swing.rightBars}
        </Row>
        {'classification' in swing && swing.classification ? (
          <Row label="Classification">{swing.classification}</Row>
        ) : null}
        {candle ? (
          <p className="text-muted-foreground">
            OHLC {candle.open} / {candle.high} / {candle.low} / {candle.close}
          </p>
        ) : null}
        <p className="text-pretty text-muted-foreground">{swing.reason}</p>
      </>
    )
  }

  if (isBosKind(event.kind) || isChochKind(event.kind)) {
    const breakEvent = event as SmcBosEvent | SmcChochEvent
    const swing = swings.find((s) => s.id === breakEvent.brokenSwingId)
    const bull = breakEvent.kind.startsWith('BULLISH')
    const isChoch = isChochKind(breakEvent.kind)
    const priceOk = bull
      ? breakEvent.closePrice > breakEvent.brokenSwingPrice
      : breakEvent.closePrice < breakEvent.brokenSwingPrice
    const confirmOk = breakEvent.candleIndex >= breakEvent.brokenSwingConfirmedAtIndex
    return (
      <>
        <p className="font-medium">
          {bull ? 'Bullish' : 'Bearish'} {isChoch ? 'CHoCH' : 'BOS'} detected
        </p>
        <Row label="brokenSwingId">
          <span className="font-mono text-[10px]">{breakEvent.brokenSwingId}</span>
        </Row>
        <Row label="brokenSwingPrice">
          <span className="font-mono">{breakEvent.brokenSwingPrice}</span>
          {swing ? ` (${swing.kind})` : ' (swing missing from visible set)'}
        </Row>
        <Row label="Swing candle index">{breakEvent.brokenSwingCandleIndex}</Row>
        <Row label="Swing confirmation index">{breakEvent.brokenSwingConfirmedAtIndex}</Row>
        <Row label="Break candle index">{breakEvent.candleIndex}</Row>
        <Row label="Break timestamp">{new Date(breakEvent.timestamp).toLocaleString()}</Row>
        <Row label="Close">
          <span className="font-mono">{breakEvent.closePrice}</span>
        </Row>
        <Row label="Break amount / %">
          <span className="font-mono">
            {breakEvent.breakAmount} / {breakEvent.breakPercent.toFixed(4)}%
          </span>
        </Row>
        {'previousStructureState' in breakEvent && breakEvent.previousStructureState ? (
          <Row label="Structure">
            {breakEvent.previousStructureState}
            {'newStructureState' in breakEvent && breakEvent.newStructureState
              ? ` → ${breakEvent.newStructureState}`
              : null}
            {'newProvisionalStructureState' in breakEvent
              ? ` → ${breakEvent.newProvisionalStructureState}`
              : null}
          </Row>
        ) : null}
        <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-white/[0.02] p-2">
          <p className="font-medium">Rule checks</p>
          <p>
            close vs swing:{' '}
            <span className={priceOk ? 'text-emerald-300' : 'text-danger'}>
              {priceOk ? 'PASS' : 'FAIL'}
            </span>
          </p>
          <p>
            index ≥ confirm:{' '}
            <span className={confirmOk ? 'text-emerald-300' : 'text-danger'}>
              {confirmOk ? 'PASS' : 'FAIL'}
            </span>
          </p>
          {'ruleChecks' in breakEvent && breakEvent.ruleChecks
            ? Object.entries(breakEvent.ruleChecks).map(([key, ok]) => (
                <p key={key}>
                  {key}:{' '}
                  <span className={ok ? 'text-emerald-300' : 'text-danger'}>
                    {ok ? 'PASS' : 'FAIL'}
                  </span>
                </p>
              ))
            : null}
        </div>
        <p className="text-pretty text-muted-foreground">{breakEvent.reason}</p>
      </>
    )
  }

  if (event.kind.includes('DISPLACEMENT')) {
    const d = event as SmcDisplacementEvent
    return (
      <>
        <Row label="Candle index">{d.candleIndex}</Row>
        <Row label="Body / Range">
          <span className="font-mono">
            {d.bodySize} / {d.fullRange}
          </span>
        </Row>
        <Row label="ATR / Body×ATR">
          <span className="font-mono">
            {d.atr} / {d.bodyAtrMultiple.toFixed(2)}
          </span>
        </Row>
        <Row label="Body/Range ratio">
          <span className="font-mono">{d.bodyToRangeRatio.toFixed(3)}</span>
        </Row>
        <Row label="Structure break id">{d.structureBreakId ?? '—'}</Row>
        <Row label="FVG id">{d.fvgId ?? '—'}</Row>
        <p className="text-pretty text-muted-foreground">{d.reason}</p>
      </>
    )
  }

  if (event.kind.includes('FVG') || event.kind.includes('FAIR')) {
    const f = event as SmcFvgEvent
    return (
      <>
        <Row label="FVG id">
          <span className="font-mono text-[10px]">{f.fvgId}</span>
        </Row>
        <Row label="Direction">{f.direction}</Row>
        <Row label="State">{f.state}</Row>
        <Row label="Boundaries">
          <span className="font-mono">
            {f.upperBoundary} / {f.lowerBoundary} (mid {f.midpoint})
          </span>
        </Row>
        <Row label="Gap size / %">
          <span className="font-mono">
            {f.gapSize} / {f.gapPercent.toFixed(4)}%
          </span>
        </Row>
        <Row label="Candle indices">{f.candleIndices.join(' → ')}</Row>
        <Row label="Displacement id">{f.displacementId ?? '—'}</Row>
        <p className="text-pretty text-muted-foreground">{f.reason}</p>
      </>
    )
  }

  if (event.kind === 'EQUAL_HIGHS' || event.kind === 'EQUAL_LOWS') {
    const e = event as SmcEqualLevelEvent
    return (
      <>
        <Row label="Level">
          <span className="font-mono">{e.level}</span>
        </Row>
        <Row label="Touches">{e.touchCount}</Row>
        <Row label="Member range">
          <span className="font-mono">
            {e.minMemberPrice} – {e.maxMemberPrice}
          </span>
        </Row>
        <Row label="Members">{e.memberSwingIds.length}</Row>
        <p className="text-pretty text-muted-foreground">{e.reason}</p>
      </>
    )
  }

  if (event.kind.includes('LIQUIDITY_SWEEP')) {
    const s = event as SmcLiquiditySweepEvent
    return (
      <>
        <Row label="Swept level">
          <span className="font-mono">{s.sweptLevel}</span>
        </Row>
        <Row label="Wick / Close">
          <span className="font-mono">
            {s.wickExtreme} / {s.close}
          </span>
        </Row>
        <Row label="Penetration">
          <span className="font-mono">
            {s.penetration} ({s.penetrationPercent.toFixed(4)}%)
          </span>
        </Row>
        <Row label="Scope">{s.structuralScope}</Row>
        <Row label="Displacement id">{s.displacementId ?? '—'}</Row>
        <Row label="Equal level id">{s.equalLevelId ?? '—'}</Row>
        {'ruleChecks' in s && s.ruleChecks ? (
          <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-white/[0.02] p-2">
            <p className="font-medium">Rule checks</p>
            {Object.entries(s.ruleChecks).map(([key, ok]) => (
              <p key={key}>
                {key}:{' '}
                <span className={ok ? 'text-emerald-300' : 'text-danger'}>
                  {ok ? 'PASS' : 'FAIL'}
                </span>
              </p>
            ))}
          </div>
        ) : null}
        <p className="text-pretty text-muted-foreground">{s.reason}</p>
      </>
    )
  }

  if (event.kind.includes('ORDER_BLOCK')) {
    const o = event as SmcOrderBlockEvent
    return (
      <>
        <Row label="Order Block id">
          <span className="font-mono text-[10px]">{o.orderBlockId}</span>
        </Row>
        <Row label="Direction">{o.direction}</Row>
        <Row label="Zone">
          <span className="font-mono">
            {o.zoneHigh} / {o.zoneLow} (mid {o.midpoint})
          </span>
        </Row>
        <Row label="Mitigation">{o.mitigationStatus}</Row>
        <Row label="Invalidated">{o.invalidationStatus ? 'yes' : 'no'}</Row>
        <Row label="Source break">
          {o.sourceBreakKind} · {o.sourceBreakId}
        </Row>
        <Row label="Source candle">{o.sourceCandleIndex}</Row>
        <Row label="Displacement id">{o.sourceDisplacementId ?? '—'}</Row>
        <Row label="FVG id">{o.sourceFvgId ?? '—'}</Row>
        <p className="text-pretty text-muted-foreground">{o.reason}</p>
      </>
    )
  }

  return <p className="text-muted-foreground">Unsupported event kind: {event.kind}</p>
}
