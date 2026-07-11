import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, VolatilityAnalysis } from '../types/index.js'
import { atr } from '../utils/math.js'

export class VolatilityAnalyzer extends BaseAnalyzer {
  readonly name = 'volatility'
  readonly weight = 1.2

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags: string[] = []
    if (analysis.state === 'expansion') tags.push('expansion')
    if (analysis.state === 'compression') tags.push('compression')
    if (analysis.spikeDetected) tags.push('volatility-spike')

    let score = 60
    if (analysis.state === 'expansion') score = 75
    if (analysis.state === 'compression') score = 45
    if (analysis.spikeDetected) score = 55

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): VolatilityAnalysis {
    const { candles, candleIndex } = context
    const period = 14
    const currentAtr = atr(candles, period, candleIndex)

    let atrSum = 0
    const baseline = Math.min(50, candleIndex)
    const start = Math.max(1, candleIndex - baseline)
    for (let i = start; i < candleIndex; i++) atrSum += atr(candles, period, i)
    const avgAtr = baseline > 0 ? atrSum / baseline : currentAtr
    const atrRatio = avgAtr > 0 ? currentAtr / avgAtr : 1

    const dayStart = Math.max(0, candleIndex - 24)
    let dayHigh = -Infinity
    let dayLow = Infinity
    for (let i = dayStart; i <= candleIndex; i++) {
      dayHigh = Math.max(dayHigh, candles[i].high)
      dayLow = Math.min(dayLow, candles[i].low)
    }
    const dailyRange = dayHigh - dayLow

    let state: VolatilityAnalysis['state'] = 'normal'
    if (atrRatio >= 1.5) state = 'expansion'
    else if (atrRatio <= 0.7) state = 'compression'

    const spikeDetected = atrRatio >= 2.0

    return { atr: currentAtr, atrRatio, dailyRange, state, spikeDetected }
  }
}
