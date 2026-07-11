import { classifySession } from '@trading-os/market-data'
import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, SessionAnalysis } from '../types/index.js'
import type { SessionType } from '@trading-os/market-data'
import { atr } from '../utils/math.js'

const SESSION_STRENGTH: Record<SessionType, number> = {
  overlap: 90,
  london: 85,
  new_york: 80,
  asian: 55,
  off_hours: 30,
}

const SESSION_LABELS: Record<SessionType, string> = {
  asian: 'asian-session',
  london: 'london-session',
  new_york: 'new-york-session',
  overlap: 'overlap-session',
  off_hours: 'off-hours',
}

export class SessionAnalyzer extends BaseAnalyzer {
  readonly name = 'session'
  readonly weight = 1.0

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags = [SESSION_LABELS[analysis.session]]
    if (analysis.isOpen) tags.push('session-open')
    if (analysis.strength >= 80) tags.push('high-session-strength')

    return this.contribution(analysis.strength, tags, { ...analysis })
  }

  compute(context: AnalysisContext): SessionAnalysis {
    const { candles, candleIndex } = context
    const c = candles[candleIndex]
    const session = c.session ?? classifySession(c.timestamp)
    const strength = SESSION_STRENGTH[session]

    const volStart = Math.max(0, candleIndex - 10)
    let volSum = 0
    for (let i = volStart; i <= candleIndex; i++) volSum += atr(candles, 14, i)
    const volatility = volSum / (candleIndex - volStart + 1)

    const mins = new Date(c.timestamp).getUTCMinutes()
    const isOpen = mins < 30

    return { session, strength, volatility, isOpen }
  }
}
