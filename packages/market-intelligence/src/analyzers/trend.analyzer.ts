import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, TrendAnalysis } from '../types/index.js'
import { ema, trendFromCloses } from '../utils/math.js'

export class TrendAnalyzer extends BaseAnalyzer {
  readonly name = 'trend'
  readonly weight = 1.5

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags: string[] = []
    if (analysis.strength >= 70) tags.push(analysis.direction === 'bullish' ? 'strong-trend' : 'strong-trend')
    else if (analysis.strength < 30) tags.push('weak-trend')
    if (analysis.phase === 'accelerating') tags.push('trend-accelerating')
    if (analysis.phase === 'weakening') tags.push('trend-weakening')
    tags.push(`${analysis.direction}-trend`)

    const aligned = (context.event.direction === 'bullish' && analysis.direction === 'bullish')
      || (context.event.direction === 'bearish' && analysis.direction === 'bearish')
    const score = aligned ? 60 + analysis.strength * 0.4 : 40 - analysis.strength * 0.2

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): TrendAnalysis {
    const { candles, candleIndex } = context
    const period = 20
    const start = Math.max(0, candleIndex - period + 1)
    const slice = candles.slice(start, candleIndex + 1)
    const closes = slice.map((c) => c.close)
    const { direction, strength } = trendFromCloses(closes)

    const emaValues = ema(candles.map((c) => c.close), period)
    const slope = candleIndex >= 1
      ? (emaValues[candleIndex] - emaValues[candleIndex - 1]) / emaValues[candleIndex - 1]
      : 0

    let phase: TrendAnalysis['phase'] = 'stable'
    if (Math.abs(slope) > 0.0005) phase = 'accelerating'
    else if (Math.abs(slope) < 0.0001) phase = 'weakening'

    return { direction, strength, phase, emaSlope: slope }
  }
}
