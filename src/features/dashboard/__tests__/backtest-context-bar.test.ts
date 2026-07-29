import { describe, expect, it } from 'vitest'
import { formatEquityDateRange } from '../BacktestContextBar'

describe('formatEquityDateRange', () => {
  it('returns null for empty input', () => {
    expect(formatEquityDateRange([])).toBeNull()
    expect(formatEquityDateRange(null)).toBeNull()
    expect(formatEquityDateRange(undefined)).toBeNull()
  })

  it('formats a single-day range', () => {
    const day = Date.parse('2024-03-01T12:00:00.000Z')
    expect(formatEquityDateRange([{ time: day }, { time: day }])).toBe('2024-03-01')
  })

  it('formats a multi-day range', () => {
    expect(
      formatEquityDateRange([
        { time: Date.parse('2024-01-01T00:00:00.000Z') },
        { time: Date.parse('2024-01-15T00:00:00.000Z') },
      ]),
    ).toBe('2024-01-01 → 2024-01-15')
  })
})
