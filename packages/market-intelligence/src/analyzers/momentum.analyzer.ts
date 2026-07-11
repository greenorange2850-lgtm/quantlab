import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, MomentumAnalysis } from '../types/index.js'
import { rsi } from '../utils/math.js'

export class MomentumAnalyzer extends BaseAnalyzer {
  readonly name = 'momentum'
  readonly weight = 1.1

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags: string[] = [`${analysis.direction}-momentum`]
    if (analysis.strength >= 70) tags.push('strong-momentum')
    if (analysis.rsi > 70) tags.push('overbought')
    if (analysis.rsi < 30) tags.push('oversold')

    const aligned = (context.event.direction === 'bullish' && analysis.direction === 'bullish')
      || (context.event.direction === 'bearish' && analysis.direction === 'bearish')
    const score = aligned ? 55 + analysis.strength * 0.45 : 45

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): MomentumAnalysis {
    const { candles, candleIndex } = context
    const rsiVal = rsi(candles, 14, candleIndex)
    const direction = rsiVal > 55 ? 'bullish' : rsiVal < 45 ? 'bearish' : 'sideways'
    const strength = Math.abs(rsiVal - 50) * 2
    return { rsi: rsiVal, direction, strength }
  }
}
