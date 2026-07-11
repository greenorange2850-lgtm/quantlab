import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { atr } from '../utils/candle-math.js'
import { ConfidenceEngine } from '../engine/confidence.engine.js'

export class AtrExpansionPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'atr-expansion',
    name: 'ATR Expansion',
    version: '1.0.0',
    description: 'Detects volatility expansion when ATR exceeds baseline',
    author: 'system',
    priority: 50,
    dependencies: [],
    outputEvents: ['ATR Expansion'],
    tags: ['atr', 'volatility', 'expansion'],
    parameters: BaseRulePlugin.params(
      { key: 'atrPeriod', label: 'ATR Period', type: 'number', default: 14, min: 5, max: 50 },
      { key: 'expansionMultiplier', label: 'Expansion Multiplier', type: 'number', default: 1.5, min: 1.1, max: 5 },
      { key: 'baselinePeriod', label: 'Baseline Period', type: 'number', default: 50, min: 20, max: 200 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const atrPeriod = this.param('atrPeriod', 14)
    const mult = this.param('expansionMultiplier', 1.5)
    const baseline = this.param('baselinePeriod', 50)

    if (index < baseline) return []

    const currentAtr = atr(candles, atrPeriod, index)
    let atrSum = 0
    const start = index - baseline
    for (let i = start; i < index; i++) atrSum += atr(candles, atrPeriod, i)
    const avgAtr = atrSum / baseline

    if (avgAtr > 0 && currentAtr >= avgAtr * mult) {
      const ratio = currentAtr / avgAtr
      const direction = candles[index].close > candles[index].open ? 'bullish' : 'bearish'
      return [this.detection(context, direction, 68, {
        atrRatio: ratio, currentAtr, avgAtr,
      }, ['atr-expansion', 'volatility'])]
    }

    return []
  }

  confidence(detection: RuleDetection): number {
    const ratio = (detection.metadata.atrRatio as number) ?? 1
    return ConfidenceEngine.calculate(detection, {
      pattern_strength: detection.rawScore,
      structure_context: Math.min(100, ratio * 40),
    })
  }

  explain(detection: RuleDetection): string {
    return `ATR expansion at ${detection.timestamp} — ${(detection.metadata.atrRatio as number).toFixed(2)}x baseline`
  }
}
