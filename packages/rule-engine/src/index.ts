export type {
  EventDirection,
  TimeframeCode,
  Candle,
  RuleParameter,
  RuleMetadata,
  RuleDetection,
  MarketEvent,
  EventDependency,
  EventScoreBreakdown,
  RuleContext,
  ScanOptions,
  ScanResult,
  DebugReport,
  RuleDebugEntry,
  CompositionRule,
  IRulePlugin,
  ICandleProvider,
  IEventRepository,
} from './types/index.js'

export {
  TIMEFRAME_HIERARCHY,
  HTF_MAP,
} from './types/index.js'

export { BaseRulePlugin, createEventId } from './core/base-rule-plugin.js'
export { ConfidenceEngine, applyConfidence } from './engine/confidence.engine.js'
export { MtfContext } from './engine/mtf-context.js'
export { CompositionEngine, sortPluginsByDependencies } from './engine/composition.engine.js'
export { BatchProcessor } from './engine/batch-processor.js'
export { DebugReporter } from './engine/debug-reporter.js'
export { RuleEngine } from './engine/rule-engine.js'
export { EventEngine } from './engine/event-engine.js'
export { PluginLoader } from './loader/plugin-loader.js'
export { RepositoryCandleProvider } from './providers/candle-provider.js'
export type { CandleSource } from './providers/candle-provider.js'
export { ScanService } from './services/scan.service.js'
export { ReplayService } from './services/replay.service.js'
export type { ReplayFrame } from './services/replay.service.js'
export { discoverPlugins } from './plugins/index.js'

import { discoverPlugins } from './plugins/index.js'
import { RepositoryCandleProvider } from './providers/candle-provider.js'
import { ScanService } from './services/scan.service.js'
import { ReplayService } from './services/replay.service.js'
import type { ICandleProvider, IEventRepository } from './types/index.js'
import type { CandleSource } from './providers/candle-provider.js'

export interface RuleEngineFactory {
  scan: ScanService
  replay: ReplayService
  plugins: ReturnType<typeof discoverPlugins>
}

export function createRuleEngine(
  candleSource: CandleSource,
  eventRepository: IEventRepository,
): RuleEngineFactory {
  const candleProvider: ICandleProvider = new RepositoryCandleProvider(candleSource)
  const plugins = discoverPlugins()

  for (const p of plugins) {
    eventRepository.saveRuleDefinition(p.metadata)
  }

  return {
    scan: new ScanService(candleProvider, eventRepository, plugins),
    replay: new ReplayService(eventRepository, candleProvider),
    plugins,
  }
}
