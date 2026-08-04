import type { ReactNode } from 'react'
import type { QmlPattern } from '@/core/smc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export type QmlWrongTag =
  | 'incorrect_prior_trend'
  | 'wrong_lh_hl'
  | 'wrong_ll_hh'
  | 'invalid_choch'
  | 'wrong_source_candle'
  | 'invalid_zone'
  | 'false_retest'
  | 'confirmation_too_weak'
  | 'duplicate_qml'
  | 'look_ahead_concern'
  | 'other'

const QML_WRONG_TAGS: { id: QmlWrongTag; label: string }[] = [
  { id: 'incorrect_prior_trend', label: 'Incorrect prior trend' },
  { id: 'wrong_lh_hl', label: 'Wrong LH / HL' },
  { id: 'wrong_ll_hh', label: 'Wrong LL / HH' },
  { id: 'invalid_choch', label: 'Invalid CHoCH' },
  { id: 'wrong_source_candle', label: 'Wrong source candle' },
  { id: 'invalid_zone', label: 'Invalid zone' },
  { id: 'false_retest', label: 'False retest' },
  { id: 'confirmation_too_weak', label: 'Confirmation too weak' },
  { id: 'duplicate_qml', label: 'Duplicate QML' },
  { id: 'look_ahead_concern', label: 'Look-ahead concern' },
  { id: 'other', label: 'Other' },
]

interface QmlInspectorProps {
  pattern: QmlPattern | null
  note: string
  tags: QmlWrongTag[]
  onNoteChange: (note: string) => void
  onTagsChange: (tags: QmlWrongTag[]) => void
  onVerdict: (verdict: 'correct' | 'wrong' | 'unsure') => void
  onResetReview: () => void
  reviewVerdict?: 'correct' | 'wrong' | 'unsure' | null
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 text-[11px]">
      <div className="text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words font-mono">{children}</div>
    </div>
  )
}

export function QmlInspector({
  pattern,
  note,
  tags,
  onNoteChange,
  onTagsChange,
  onVerdict,
  onResetReview,
  reviewVerdict = null,
}: QmlInspectorProps) {
  if (!pattern) {
    return (
      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">QML Inspector</CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] text-muted-foreground">
          Select a QML setup to inspect the full structural chain.
        </CardContent>
      </Card>
    )
  }

  const toggleTag = (id: QmlWrongTag) => {
    if (tags.includes(id)) onTagsChange(tags.filter((t) => t !== id))
    else onTagsChange([...tags, id])
  }

  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm">QML Inspector</CardTitle>
          <Badge variant="outline">{pattern.direction}</Badge>
          <Badge variant="outline">{pattern.status}</Badge>
          {pattern.status === 'ENTRY_READY' ? (
            <Badge className="bg-emerald-600 text-white">ENTRY READY</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row label="Setup strength">{pattern.setupStrength} / 100</Row>
        <Row label="Prior Dow trend">
          {pattern.priorTrend} · strength {pattern.trendStrength}
        </Row>
        <Row label="Structural sequence">
          {pattern.sourceSwingId} → {pattern.extremeSwingId} → {pattern.structureShiftEventId}
        </Row>
        <Row label="Source swing">{pattern.sourceSwingId}</Row>
        <Row label="Extreme swing">{pattern.extremeSwingId}</Row>
        <Row label="CHoCH event">{pattern.structureShiftEventId || '—'}</Row>
        <Row label="Source candle">
          {pattern.sourceCandleIndex ?? '—'}
          {pattern.sourceCandleTime != null ? ` · t=${pattern.sourceCandleTime}` : ''}
        </Row>
        <Row label="Zone">
          [{pattern.zoneLow}, {pattern.zoneHigh}] · {pattern.zoneMode}
        </Row>
        <Row label="Zone lifecycle">
          created {pattern.createdIndex}
          {pattern.retestIndex != null ? ` · retest ${pattern.retestIndex}` : ''}
          {pattern.invalidatedIndex != null ? ` · invalid ${pattern.invalidatedIndex}` : ''}
          {pattern.expiredIndex != null ? ` · expired ${pattern.expiredIndex}` : ''}
          {' · end '}
          {pattern.zoneEndIndex}
        </Row>
        {pattern.retestDetails ? (
          <Row label="Retest details">
            idx {pattern.retestDetails.firstRetestIndex} · pen{' '}
            {pattern.retestDetails.penetrationPercent.toFixed(1)}% · close{' '}
            {pattern.retestDetails.closeLocation} · rejection{' '}
            {pattern.retestDetails.rejectionOccurred ? 'yes' : 'no'} · touches{' '}
            {pattern.retestDetails.touchCount}
          </Row>
        ) : null}
        <Row label="Confirmations">
          {[
            pattern.confirmationRefs.rejectionEventId && 'rejection',
            pattern.confirmationRefs.displacementEventId && 'displacement',
            pattern.confirmationRefs.fvgEventId && 'fvg',
            pattern.confirmationRefs.sweepEventId && 'sweep',
            pattern.confirmationRefs.orderBlockId && 'ob',
          ]
            .filter(Boolean)
            .join(', ') || 'none'}
        </Row>
        <Row label="Missing checks">
          {pattern.missingChecks.length ? pattern.missingChecks.join(', ') : 'none'}
        </Row>
        <Row label="Invalidation">{pattern.invalidationMode}</Row>
        <Row label="Event chain">{pattern.eventChain.join(' → ')}</Row>
        <Row label="Source why">
          <ul className="list-disc pl-4">
            {pattern.sourceSelection.explanation.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Row>
        <Row label="Score factors">
          <ul className="list-disc pl-4">
            {pattern.scoreBreakdown.factors.map((f) => (
              <li key={f.id}>
                {f.delta >= 0 ? '+' : ''}
                {f.delta} {f.label}
              </li>
            ))}
          </ul>
        </Row>

        <div className="border-t border-border pt-2">
          <p className="mb-1 text-[11px] text-muted-foreground">Manual review</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onVerdict('correct')}>
              Correct
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => onVerdict('wrong')}>
              Wrong
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onVerdict('unsure')}>
              Unsure
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onResetReview}>
              Reset
            </Button>
          </div>
          {reviewVerdict ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Current verdict: {reviewVerdict}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            {QML_WRONG_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`rounded border px-1.5 py-0.5 text-[10px] ${
                  tags.includes(t.id)
                    ? 'border-rose-400/50 bg-rose-500/10'
                    : 'border-border text-muted-foreground'
                }`}
                onClick={() => toggleTag(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Input
            className="mt-2"
            placeholder="Review note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export { QML_WRONG_TAGS }
