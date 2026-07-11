import type { SessionType } from '../types/index.js'

interface SessionWindow {
  type: SessionType
  startHour: number
  startMin: number
  endHour: number
  endMin: number
}

const SESSIONS: SessionWindow[] = [
  { type: 'asian',    startHour: 0,  startMin: 0, endHour: 8,  endMin: 0 },
  { type: 'london',   startHour: 8,  startMin: 0, endHour: 16, endMin: 0 },
  { type: 'new_york', startHour: 13, startMin: 0, endHour: 21, endMin: 0 },
  { type: 'overlap',  startHour: 13, startMin: 0, endHour: 16, endMin: 0 },
]

function toMinutes(h: number, m: number) {
  return h * 60 + m
}

export function classifySession(timestamp: string): SessionType {
  const d = new Date(timestamp)
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes()

  const inOverlap = mins >= toMinutes(13, 0) && mins < toMinutes(16, 0)
  if (inOverlap) return 'overlap'

  for (const s of SESSIONS) {
    const start = toMinutes(s.startHour, s.startMin)
    const end = toMinutes(s.endHour, s.endMin)
    if (s.type === 'overlap') continue
    if (mins >= start && mins < end) return s.type
  }

  return 'off_hours'
}

export function classifySessions(timestamps: string[]): SessionType[] {
  return timestamps.map(classifySession)
}

export function getSessionWindows() {
  return SESSIONS.map((s) => ({
    type: s.type,
    startUtc: `${String(s.startHour).padStart(2, '0')}:${String(s.startMin).padStart(2, '0')}`,
    endUtc: `${String(s.endHour).padStart(2, '0')}:${String(s.endMin).padStart(2, '0')}`,
  }))
}
