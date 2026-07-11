import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import {
  atr, candleBody, candleRange,
  upperWick, lowerWick, wickRatio,
} from '../utils/candle-math.js'
import { ConfidenceEngine } from '../engine/confidence.engine.js'

export class CrtPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'crt',
    name: 'CRT',
    version: '1.0.0',
    description: 'Candle Range Theory — detects rejection candles with significant wick-to-body ratio',
    author: 'system',
    priority: 80,
    dependencies: [],
    outputEvents: ['Bullish CRT', 'Bearish CRT'],
    tags: ['crt', 'rejection', 'wick'],
    parameters: BaseRulePlugin.params(
      { key: 'minBodyRatio', label: 'Min Body Ratio', type: 'number', default: 0.3, min: 0.1, max: 0.9 },
      { key: 'minWickRatio', label: 'Min Wick Ratio', type: 'number', default: 0.55, min: 0.3, max: 0.95 },
      { key: 'atrMultiplier', label: 'ATR Multiplier', type: 'number', default: 0.5, min: 0.1, max: 3 },
      { key: 'atrPeriod', label: 'ATR Period', type: 'number', default: 14, min: 5, max: 50 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const c = candles[index]
    const minWick = this.param('minWickRatio', 0.55)
    const minBody = this.param('minBodyRatio', 0.3)
    const atrMult = this.param('atrMultiplier', 0.5)
    const atrPeriod = this.param('atrPeriod', 14)

    const range = candleRange(c)
    if (range === 0) return []

    const body = candleBody(c)
    const bodyRatio = body / range
    const wRatio = wickRatio(c)
    const currentAtr = atr(candles, atrPeriod, index)

    if (bodyRatio < minBody && wRatio >= minWick && range >= currentAtr * atrMult) {
      const isBullRejection = lowerWick(c) > upperWick(c) * 1.5
      const isBearRejection = upperWick(c) > lowerWick(c) * 1.5

      if (isBullRejection) {
        return [this.detection(context, 'bullish', 85, {
          wickRatio: wRatio, bodyRatio, atr: currentAtr, type: 'bullish_crt',
        }, ['bullish-crt', 'rejection'])]
      }
      if (isBearRejection) {
        return [this.detection(context, 'bearish', 85, {
          wickRatio: wRatio, bodyRatio, atr: currentAtr, type: 'bearish_crt',
        }, ['bearish-crt', 'rejection'])]
      }
    }
    return []
  }

  confidence(detection: RuleDetection, context: RuleContext): number {
    const wRatio = (detection.metadata.wickRatio as number) ?? 0
    return ConfidenceEngine.calculate(detection, {
      pattern_strength: detection.rawScore,
      wick_ratio: wRatio * 100,
      structure_context: context.htfCandles ? 70 : 50,
    })
  }

  explain(detection: RuleDetection, _context: RuleContext): string {
    const dir = detection.direction === 'bullish' ? 'Bullish' : 'Bearish'
    return `${dir} CRT rejection at ${detection.timestamp} — wick ratio ${((detection.metadata.wickRatio as number) * 100).toFixed(1)}%`
  }
}
