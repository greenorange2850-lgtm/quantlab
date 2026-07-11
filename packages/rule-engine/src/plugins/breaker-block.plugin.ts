import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'

export class BreakerBlockPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'breaker-block',
    name: 'Breaker Block',
    version: '1.0.0',
    description: 'Failed order block that flips polarity after being violated',
    author: 'system',
    priority: 72,
    dependencies: ['order-block'],
    outputEvents: ['Bullish Breaker Block', 'Bearish Breaker Block'],
    tags: ['breaker-block', 'institutional', 'failed-ob'],
    parameters: BaseRulePlugin.params(
      { key: 'lookback', label: 'Lookback Candles', type: 'number', default: 20, min: 5, max: 100 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index, priorEvents } = context
    const lookback = this.param('lookback', 20)
    if (index < 3) return []

    const obEvents = priorEvents.filter((e) => e.ruleId === 'order-block')
    const recentOb = obEvents[obEvents.length - 1]
    if (!recentOb?.candleIndex) return []

    const obIdx = recentOb.candleIndex - (index - lookback > 0 ? index - lookback : 0)
    if (obIdx < 0 || obIdx >= candles.length) return []

    const c = candles[index]
    const obHigh = recentOb.metadata.obHigh as number
    const obLow = recentOb.metadata.obLow as number

    if (recentOb.direction === 'bullish' && c.close < obLow) {
      return [this.detection(context, 'bearish', 76, {
        breakerOf: recentOb.id, obHigh, obLow,
      }, ['bearish-breaker'])]
    }

    if (recentOb.direction === 'bearish' && c.close > obHigh) {
      return [this.detection(context, 'bullish', 76, {
        breakerOf: recentOb.id, obHigh, obLow,
      }, ['bullish-breaker'])]
    }

    return []
  }

  explain(detection: RuleDetection): string {
    return `Breaker Block ${detection.direction} at ${detection.timestamp}`
  }
}
