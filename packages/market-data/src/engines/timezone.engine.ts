import type { TimezoneMode } from '../types/index.js'

const BROKER_OFFSETS: Record<string, number> = {
  default: 2,
  utc: 0,
}

export function convertTimezone(
  timestamp: string,
  from: TimezoneMode,
  to: TimezoneMode = 'utc',
): string {
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return timestamp

  if (from === to) return d.toISOString()

  let offsetMs = 0
  if (from === 'broker') offsetMs = -(BROKER_OFFSETS.default * 60 * 60 * 1000)
  if (to === 'broker') offsetMs = BROKER_OFFSETS.default * 60 * 60 * 1000

  return new Date(d.getTime() + offsetMs).toISOString()
}

export function convertTimestamps(
  timestamps: string[],
  from: TimezoneMode,
  to: TimezoneMode = 'utc',
): string[] {
  return timestamps.map((ts) => convertTimezone(ts, from, to))
}

export function detectTimezoneFromData(timestamps: string[]): TimezoneMode {
  if (timestamps.length === 0) return 'utc'
  const hours = timestamps.slice(0, 100).map((ts) => new Date(ts).getUTCHours())
  const nightCount = hours.filter((h) => h >= 22 || h <= 2).length
  return nightCount > hours.length * 0.5 ? 'broker' : 'utc'
}
