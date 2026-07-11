import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { isBearish, isBullish, candleBody } from '../utils/candle-math.js'

export class OrderBlockPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'order-block',
    name: 'Order Block',
    version: '1.0.0',
    description: 'Last opposing candle before a strong impulse move',
    author: 'system',
    priority: 70,
    dependencies: [],
    outputEvents: ['Bullish Order Block', 'Bearish Order Block'],
    tags: ['order-block', 'institutional', 'supply-demand'],
    parameters: BaseRulePlugin.params(
      { key: 'impulseMultiplier', label: 'Impulse Body Multiplier', type: 'number', default: 2.0, min: 1.0, max: 5 },
      { key: 'lookback', label: 'Lookback Candles', type: 'number', default: 10, min: 3, max: 50 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const mult = this.param('impulseMultiplier', 2.0)
    const lookback = this.param('lookback', 10)
    if (index < 2) return []

    const c = candles[index]
    const prev = candles[index - 1]
    const avgBody = this.avgBody(candles, index, lookback)

    const isBullImpulse = isBullish(c) && candleBody(c) > avgBody * mult
    const isBearImpulse = isBearish(c) && candleBody(c) > avgBody * mult

    if (isBullImpulse && isBearish(prev)) {
      return [this.detection(context, 'bullish', 78, {
        obHigh: prev.high, obLow: prev.low, impulseIndex: index,
      }, ['bullish-ob'], [index - 1, index])]
    }

    if (isBearImpulse && isBullish(prev)) {
      return [this.detection(context, 'bearish', 78, {
        obHigh: prev.high, obLow: prev.low, impulseIndex: index,
      }, ['bearish-ob'], [index - 1, index])]
    }

    return []
  }

  private avgBody(candles: RuleContext['candles'], index: number, period: number): number {
    const start = Math.max(0, index - period)
    let sum = 0
    for (let i = start; i < index; i++) sum += candleBody(candles[i])
    return sum / (index - start || 1)
  }

  explain(detection: RuleDetection): string {
    return `Order Block ${detection.direction} at ${detection.timestamp}`
  }
}
