import type { IRulePlugin, MarketEvent, CompositionRule } from '../types/index.js'
import { createEventId } from '../core/base-rule-plugin.js'

export class CompositionEngine {
  private compositions: CompositionRule[] = [
    {
      name: 'CRT + HTF + Liquidity',
      requiredRules: ['crt', 'liquidity-sweep'],
      direction: 'bullish',
      minConfidence: 70,
    },
    {
      name: 'FVG + BOS Confirmation',
      requiredRules: ['fvg', 'bos'],
      direction: 'bullish',
      minConfidence: 65,
    },
  ]

  compose(events: MarketEvent[], windowMs = 3600_000): MarketEvent[] {
    const composed: MarketEvent[] = []

    for (const comp of this.compositions) {
      const grouped = this.groupByTimeWindow(events, windowMs)

      for (const group of grouped) {
        const ruleNames = new Set(group.map((e) => e.ruleName.toLowerCase().replace(/\s+/g, '-')))
        const allPresent = comp.requiredRules.every((r) =>
          [...ruleNames].some((n) => n.includes(r)),
        )

        if (!allPresent) continue

        const avgConfidence = group.reduce((s, e) => s + e.confidence, 0) / group.length
        if (comp.minConfidence && avgConfidence < comp.minConfidence) continue

        const primary = group.sort((a, b) => b.confidence - a.confidence)[0]

        composed.push({
          id: createEventId(),
          ruleId: `composed-${comp.name.toLowerCase().replace(/\s+/g, '-')}`,
          ruleName: comp.name,
          ruleVersion: '1.0.0',
          symbol: primary.symbol,
          timeframe: primary.timeframe,
          timestamp: primary.timestamp,
          direction: comp.direction,
          confidence: Math.round(avgConfidence * 10) / 10,
          score: group.reduce((s, e) => s + e.score, 0) / group.length,
          explanation: `Composed from: ${group.map((e) => e.ruleName).join(' + ')}`,
          tags: ['composed', ...comp.requiredRules],
          metadata: { componentEvents: group.map((e) => e.id), rules: comp.requiredRules },
          dependencies: group.map((e) => ({
            dependsOnRule: e.ruleName,
            dependsOnEventId: e.id,
            relation: 'requires' as const,
          })),
        })
      }
    }

    return composed
  }

  registerComposition(rule: CompositionRule): void {
    this.compositions.push(rule)
  }

  private groupByTimeWindow(events: MarketEvent[], windowMs: number): MarketEvent[][] {
    if (events.length === 0) return []
    const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const groups: MarketEvent[][] = []
    let current: MarketEvent[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime()
      if (gap <= windowMs) {
        current.push(sorted[i])
      } else {
        groups.push(current)
        current = [sorted[i]]
      }
    }
    groups.push(current)
    return groups
  }
}

export function sortPluginsByDependencies(plugins: IRulePlugin[]): IRulePlugin[] {
  const sorted: IRulePlugin[] = []
  const visited = new Set<string>()
  const map = new Map(plugins.map((p) => [p.metadata.id, p]))

  function visit(plugin: IRulePlugin) {
    if (visited.has(plugin.metadata.id)) return
    for (const dep of plugin.metadata.dependencies) {
      const depPlugin = map.get(dep)
      if (depPlugin) visit(depPlugin)
    }
    visited.add(plugin.metadata.id)
    sorted.push(plugin)
  }

  const byPriority = [...plugins].sort((a, b) => b.metadata.priority - a.metadata.priority)
  for (const p of byPriority) visit(p)
  return sorted
}
