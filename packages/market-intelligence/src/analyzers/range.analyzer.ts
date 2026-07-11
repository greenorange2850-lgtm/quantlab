import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, RangeAnalysis } from '../types/index.js'

export class RangeAnalyzer extends BaseAnalyzer {
  readonly name = 'range'
  readonly weight = 1.0

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags: string[] = []
    if (analysis.inPremium) tags.push('premium-zone')
    if (analysis.inDiscount) tags.push('discount-zone')
    if (!analysis.inPremium && !analysis.inDiscount) tags.push('equilibrium')

    let score = 55
    if (context.event.direction === 'bullish' && analysis.inDiscount) score = 80
    if (context.event.direction === 'bearish' && analysis.inPremium) score = 80
    if (context.event.direction === 'bullish' && analysis.inPremium) score = 40
    if (context.event.direction === 'bearish' && analysis.inDiscount) score = 40

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): RangeAnalysis {
    const { candles, candleIndex } = context
    const period = 50
    const start = Math.max(0, candleIndex - period + 1)
    let high = -Infinity
    let low = Infinity
    for (let i = start; i <= candleIndex; i++) {
      high = Math.max(high, candles[i].high)
      low = Math.min(low, candles[i].low)
    }
    const range = high - low
    const position = range > 0 ? (candles[candleIndex].close - low) / range : 0.5
    return {
      position,
      rangeHigh: high,
      rangeLow: low,
      inPremium: position >= 0.7,
      inDiscount: position <= 0.3,
    }
  }
}
