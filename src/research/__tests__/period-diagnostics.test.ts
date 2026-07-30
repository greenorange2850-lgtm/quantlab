import { describe, expect, it } from 'vitest'
import { formatPeriodLabel, resolveResearchPeriod } from '@/data/research-period'
import { spansLookLikeLimitOnly1000x15m } from '@/research/period-diagnostics'

describe('period diagnostics fingerprint', () => {
  it('flags ~10.4 day spans as legacy 1000×15m (observed Analysis Jul 20→Jul 30)', () => {
    // Live Binance BTCUSDT 15m limit=1000 snapshot for 2026-07-30 investigation.
    const start = Date.parse('2026-07-20T01:30:00.000Z')
    const end = Date.parse('2026-07-30T11:15:00.000Z')
    expect(spansLookLikeLimitOnly1000x15m(start, end)).toBe(true)
    expect(formatPeriodLabel(start, end)).toBe('Jul 20, 2026 → Jul 30, 2026')
  })

  it('does not flag Last 30 days (~30d) as the legacy fingerprint', () => {
    const now = Date.parse('2026-07-30T12:00:00.000Z')
    const resolved = resolveResearchPeriod({ preset: 'last_30d' }, now)
    expect(spansLookLikeLimitOnly1000x15m(resolved.startMs, resolved.endMs)).toBe(false)
    expect(formatPeriodLabel(resolved.startMs, resolved.endMs)).toBe(
      'Jun 30, 2026 → Jul 30, 2026',
    )
  })
})
