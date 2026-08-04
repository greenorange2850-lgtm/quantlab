import type {
  SmcBosEvent,
  SmcChochEvent,
  SmcClassifiedSwingEvent,
  SmcSwingEvent,
} from '../types'
import type { QmlInvariantCounts, QmlPattern } from './qml-types'

export interface QmlInvariantInput {
  chochEvents: readonly SmcChochEvent[]
  swings: readonly SmcSwingEvent[]
  classifiedSwings: readonly SmcClassifiedSwingEvent[]
  bosEvents?: readonly SmcBosEvent[]
}

export function emptyQmlInvariantCounts(): QmlInvariantCounts {
  return {
    qmlWithoutPriorTrend: 0,
    sourceSwingAfterExtreme: 0,
    extremeAfterChoch: 0,
    sourceCandleAfterChoch: 0,
    retestBeforeZoneCreation: 0,
    entryReadyBeforeRetestClose: 0,
    invalidatedZoneStillActive: 0,
    duplicateCanonicalQml: 0,
    missingEventReference: 0,
    futureEventUsed: 0,
    progressiveFullMismatch: 0,
    ok: true,
  }
}

/**
 * QML structural invariants. All must be zero for status COMPLETE.
 */
export function auditQmlInvariants(
  patterns: readonly QmlPattern[],
  visibleIndex: number,
  input?: QmlInvariantInput,
): { counts: QmlInvariantCounts; details: string[] } {
  const counts = emptyQmlInvariantCounts()
  const details: string[] = []
  const seen = new Set<string>()

  for (const p of patterns) {
    if (!p.priorTrend || p.priorTrend === 'Unknown' || p.priorTrend === '') {
      // Candidates may still have priorTrend set; only flag confirmed+ without prior
      if (p.status !== 'CANDIDATE') {
        counts.qmlWithoutPriorTrend += 1
        details.push(`${p.id}: QML without prior trend`)
      }
    }

    // Resolve swing indices via event chain / stored ids when input present
    if (input) {
      const source = findSwingIndex(input, p.sourceSwingId)
      const extreme = findSwingIndex(input, p.extremeSwingId)
      const choch = input.chochEvents.find((c) => c.id === p.structureShiftEventId)

      if (p.status !== 'CANDIDATE') {
        if (source != null && extreme != null && source >= extreme) {
          counts.sourceSwingAfterExtreme += 1
          details.push(`${p.id}: source swing after extreme`)
        }
        if (extreme != null && choch && extreme >= choch.candleIndex) {
          counts.extremeAfterChoch += 1
          details.push(`${p.id}: extreme after CHoCH`)
        }
        if (
          p.sourceCandleIndex != null &&
          choch &&
          p.sourceCandleIndex >= choch.candleIndex
        ) {
          counts.sourceCandleAfterChoch += 1
          details.push(`${p.id}: source candle after CHoCH`)
        }
        if (!choch && p.structureShiftEventId) {
          counts.missingEventReference += 1
          details.push(`${p.id}: missing CHoCH event reference`)
        }
        if (choch && choch.candleIndex > visibleIndex) {
          counts.futureEventUsed += 1
          details.push(`${p.id}: future CHoCH used`)
        }
      }
    }

    if (p.retestIndex != null && p.retestIndex <= p.createdIndex) {
      counts.retestBeforeZoneCreation += 1
      details.push(`${p.id}: retest before zone creation`)
    }

    if (
      p.status === 'ENTRY_READY' &&
      (p.retestIndex == null ||
        (p.entryReadyIndex != null && p.retestIndex > p.entryReadyIndex))
    ) {
      counts.entryReadyBeforeRetestClose += 1
      details.push(`${p.id}: entry-ready before retest close`)
    }

    if (
      p.status === 'INVALIDATED' &&
      p.invalidatedIndex != null &&
      p.zoneEndIndex > p.invalidatedIndex
    ) {
      counts.invalidatedZoneStillActive += 1
      details.push(`${p.id}: invalidated zone still extending`)
    }

    if (p.status !== 'CANDIDATE') {
      if (seen.has(p.canonicalKey)) {
        counts.duplicateCanonicalQml += 1
        details.push(`${p.id}: duplicate canonical QML ${p.canonicalKey}`)
      }
      seen.add(p.canonicalKey)
    }

    // Future event used: any status index beyond visible
    const futureIdx = [
      p.createdIndex,
      p.confirmedIndex,
      p.retestIndex,
      p.entryReadyIndex,
      p.invalidatedIndex,
      p.expiredIndex,
    ].filter((n): n is number => n != null)
    if (futureIdx.some((n) => n > visibleIndex)) {
      counts.futureEventUsed += 1
      details.push(`${p.id}: future event index used beyond visible ${visibleIndex}`)
    }
  }

  counts.ok = Object.entries(counts)
    .filter(([k]) => k !== 'ok')
    .every(([, v]) => v === 0)

  return { counts, details }
}

function findSwingIndex(
  input: Pick<QmlInvariantInput, 'swings' | 'classifiedSwings'>,
  id: string,
): number | null {
  const c = input.classifiedSwings.find((s) => s.id === id || s.originalSwingId === id)
  if (c) return c.candleIndex
  const s = input.swings.find((x) => x.id === id)
  return s ? s.candleIndex : null
}

/**
 * Compare progressive-final patterns to full-history patterns by canonical identity.
 */
export function compareQmlProgressiveFull(
  progressive: readonly QmlPattern[],
  full: readonly QmlPattern[],
): { mismatch: number; details: string[] } {
  const progKeys = new Set(
    progressive.filter((p) => p.status !== 'CANDIDATE').map((p) => p.canonicalKey),
  )
  const fullKeys = new Set(
    full.filter((p) => p.status !== 'CANDIDATE').map((p) => p.canonicalKey),
  )
  const details: string[] = []
  let mismatch = 0
  for (const k of fullKeys) {
    if (!progKeys.has(k)) {
      mismatch += 1
      details.push(`Missing in progressive: ${k}`)
    }
  }
  for (const k of progKeys) {
    if (!fullKeys.has(k)) {
      mismatch += 1
      details.push(`Extra in progressive: ${k}`)
    }
  }
  // Status equality for shared keys
  const fullByKey = new Map(full.map((p) => [p.canonicalKey, p]))
  for (const p of progressive) {
    if (p.status === 'CANDIDATE') continue
    const f = fullByKey.get(p.canonicalKey)
    if (f && f.status !== p.status) {
      mismatch += 1
      details.push(`Status mismatch ${p.canonicalKey}: progressive=${p.status} full=${f.status}`)
    }
  }
  return { mismatch, details }
}
