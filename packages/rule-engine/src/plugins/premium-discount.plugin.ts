import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'

export class PremiumDiscountPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'premium-discount',
    name: 'Premium Discount',
    version: '1.0.0',
    description: 'Classifies price position within dealing range as premium or discount',
    author: 'system',
    priority: 60,
    dependencies: [],
    outputEvents: ['Premium Zone', 'Discount Zone', 'Equilibrium'],
    tags: ['premium', 'discount', 'pd-array'],
    parameters: BaseRulePlugin.params(
      { key: 'rangePeriod', label: 'Range Period', type: 'number', default: 50, min: 10, max: 500 },
      { key: 'premiumThreshold', label: 'Premium Threshold', type: 'number', default: 0.7, min: 0.5, max: 0.95 },
      { key: 'discountThreshold', label: 'Discount Threshold', type: 'number', default: 0.3, min: 0.05, max: 0.5 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const period = this.param('rangePeriod', 50)
    const premiumTh = this.param('premiumThreshold', 0.7)
    const discountTh = this.param('discountThreshold', 0.3)

    const start = Math.max(0, index - period + 1)
    let high = -Infinity
    let low = Infinity
    for (let i = start; i <= index; i++) {
      high = Math.max(high, candles[i].high)
      low = Math.min(low, candles[i].low)
    }

    const range = high - low
    if (range === 0) return []

    const position = (candles[index].close - low) / range

    if (position >= premiumTh) {
      return [this.detection(context, 'bearish', 65, {
        zone: 'premium', position, rangeHigh: high, rangeLow: low,
      }, ['premium-zone', 'pd-array'])]
    }

    if (position <= discountTh) {
      return [this.detection(context, 'bullish', 65, {
        zone: 'discount', position, rangeHigh: high, rangeLow: low,
      }, ['discount-zone', 'pd-array'])]
    }

    if (position > 0.45 && position < 0.55) {
      return [this.detection(context, 'neutral', 55, {
        zone: 'equilibrium', position, rangeHigh: high, rangeLow: low,
      }, ['equilibrium', 'pd-array'])]
    }

    return []
  }

  explain(detection: RuleDetection): string {
    return `${detection.metadata.zone} zone at ${detection.timestamp} — position ${((detection.metadata.position as number) * 100).toFixed(1)}%`
  }
}
