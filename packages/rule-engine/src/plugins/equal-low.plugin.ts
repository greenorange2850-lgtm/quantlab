import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { findSwingLows } from '../utils/candle-math.js'

export class EqualLowPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'equal-low',
    name: 'Equal Low',
    version: '1.0.0',
    description: 'Detects equal lows (liquidity pool) within tolerance',
    author: 'system',
    priority: 65,
    dependencies: [],
    outputEvents: ['Equal Low'],
    tags: ['equal-low', 'liquidity', 'eql'],
    parameters: BaseRulePlugin.params(
      { key: 'tolerance', label: 'Tolerance %', type: 'number', default: 0.0003, min: 0 },
      { key: 'swingLookback', label: 'Swing Lookback', type: 'number', default: 5, min: 2, max: 20 },
      { key: 'minTouches', label: 'Min Touches', type: 'number', default: 2, min: 2, max: 5 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const tolerance = this.param('tolerance', 0.0003)
    const lookback = this.param('swingLookback', 5)
    const minTouches = this.param('minTouches', 2)

    const swings = findSwingLows(candles.slice(0, index + 1), lookback)
    if (swings.length < minTouches) return []

    const levels: number[] = swings.map((i) => candles[i].low)
    const last = levels[levels.length - 1]
    const matches = levels.filter((l) => Math.abs(l - last) / last <= tolerance)

    if (matches.length >= minTouches) {
      return [this.detection(context, 'neutral', 70, {
        level: last, touches: matches.length, type: 'equal_low',
      }, ['equal-low', 'liquidity'])]
    }

    return []
  }

  explain(detection: RuleDetection): string {
    return `Equal Low at ${detection.timestamp} — ${detection.metadata.touches} touches at ${(detection.metadata.level as number).toFixed(5)}`
  }
}
