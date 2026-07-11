import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, LiquidityAnalysis } from '../types/index.js'
import { findSwingHighs, findSwingLows } from '../utils/math.js'

export class LiquidityAnalyzer extends BaseAnalyzer {
  readonly name = 'liquidity'
  readonly weight = 1.3

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags: string[] = []
    if (analysis.equalHighs >= 2) tags.push('equal-highs')
    if (analysis.equalLows >= 2) tags.push('equal-lows')
    if (analysis.sweepProbability > 60) tags.push('sweep-likely')
    if (analysis.restingLiquidity === 'above') tags.push('liquidity-above')
    if (analysis.restingLiquidity === 'below') tags.push('liquidity-below')

    const hasLiquidityEvent = context.relatedEvents.some((e) =>
      e.ruleName.toLowerCase().includes('liquidity') || e.ruleName.toLowerCase().includes('sweep'),
    )
    const score = hasLiquidityEvent ? 80 : 50 + analysis.sweepProbability * 0.3

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): LiquidityAnalysis {
    const { candles, candleIndex } = context
    const lookback = 5
    const slice = candles.slice(0, candleIndex + 1)
    const highs = findSwingHighs(slice, lookback)
    const lows = findSwingLows(slice, lookback)
    const tolerance = 0.0003

    const areas: LiquidityAnalysis['areas'] = []
    for (const i of highs.slice(-3)) {
      areas.push({ level: candles[i].high, type: 'high', strength: 70 })
    }
    for (const i of lows.slice(-3)) {
      areas.push({ level: candles[i].low, type: 'low', strength: 70 })
    }

    let equalHighs = 0
    let equalLows = 0
    if (highs.length >= 2) {
      const last = candles[highs[highs.length - 1]].high
      equalHighs = highs.filter((i) => Math.abs(candles[i].high - last) / last <= tolerance).length
    }
    if (lows.length >= 2) {
      const last = candles[lows[lows.length - 1]].low
      equalLows = lows.filter((i) => Math.abs(candles[i].low - last) / last <= tolerance).length
    }

    const price = candles[candleIndex].close
    const above = areas.filter((a) => a.type === 'high' && a.level > price).length
    const below = areas.filter((a) => a.type === 'low' && a.level < price).length
    const restingLiquidity: LiquidityAnalysis['restingLiquidity'] =
      above > below ? 'above' : below > above ? 'below' : 'balanced'

    const sweepProbability = Math.min(100, (equalHighs + equalLows) * 25 + (above + below) * 10)

    return { areas, sweepProbability, equalHighs, equalLows, restingLiquidity }
  }
}
