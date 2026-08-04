import type { QmlDiagnostics, QmlPattern, QmlRejectionReason } from './qml-types'

export function buildQmlDiagnostics(
  patterns: readonly QmlPattern[],
  rejectedByReason: QmlRejectionReason[],
  durationMs: number,
  duplicatePatternsSuppressed = 0,
): QmlDiagnostics {
  let confirmedBullish = 0
  let confirmedBearish = 0
  let activeZones = 0
  let retested = 0
  let entryReady = 0
  let invalidated = 0
  let expired = 0
  let structuralCandidates = 0
  let internalSourceCount = 0
  let externalSourceCount = 0
  let strengthSum = 0
  let strengthN = 0
  let barsToRetestSum = 0
  let barsToRetestN = 0

  for (const p of patterns) {
    if (p.status === 'CANDIDATE') structuralCandidates += 1
    if (p.status !== 'CANDIDATE') {
      if (p.direction === 'BULLISH') confirmedBullish += 1
      else confirmedBearish += 1
    }
    if (
      p.status === 'ZONE_ACTIVE' ||
      p.status === 'RETESTED' ||
      p.status === 'ENTRY_READY'
    ) {
      activeZones += 1
    }
    if (p.status === 'RETESTED' || p.status === 'ENTRY_READY') retested += 1
    if (p.status === 'ENTRY_READY') entryReady += 1
    if (p.status === 'INVALIDATED') invalidated += 1
    if (p.status === 'EXPIRED') expired += 1
    if (p.structureScope === 'INTERNAL') internalSourceCount += 1
    else externalSourceCount += 1
    if (p.status !== 'CANDIDATE') {
      strengthSum += p.setupStrength
      strengthN += 1
    }
    if (p.retestIndex != null && p.confirmedIndex != null) {
      barsToRetestSum += p.retestIndex - p.confirmedIndex
      barsToRetestN += 1
    }
  }

  return {
    structuralCandidates,
    confirmedBullish,
    confirmedBearish,
    activeZones,
    retested,
    entryReady,
    invalidated,
    expired,
    duplicatePatternsSuppressed,
    candidatesRejectedByReason: [...rejectedByReason].sort(
      (a, b) => b.count - a.count || a.reason.localeCompare(b.reason),
    ),
    averageStrength: strengthN > 0 ? strengthSum / strengthN : 0,
    averageBarsFromChochToRetest: barsToRetestN > 0 ? barsToRetestSum / barsToRetestN : null,
    internalSourceCount,
    externalSourceCount,
    durationMs,
  }
}
