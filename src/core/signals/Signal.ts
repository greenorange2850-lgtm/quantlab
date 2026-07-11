import type { SignalType } from './SignalType.js'

export interface Signal {
  signal: SignalType
  confidence: number
  reason: string
  timestamp: number
  symbol: string
}
