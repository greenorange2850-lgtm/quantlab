import { randomUUID } from 'node:crypto'
import type {
  IRulePlugin,
  RuleContext,
  MarketEvent,
  ScanOptions,
  ScanResult,
  ICandleProvider,
  Candle,
} from '../types/index.js'
import { createEventId } from '../core/base-rule-plugin.js'
import { PluginLoader } from '../loader/plugin-loader.js'
import { MtfContext } from './mtf-context.js'
import { CompositionEngine, sortPluginsByDependencies } from './composition.engine.js'
import { BatchProcessor } from './batch-processor.js'
import { DebugReporter } from './debug-reporter.js'

export class RuleEngine {
  private loader = new PluginLoader()
  private composition = new CompositionEngine()
  private mtf: MtfContext
  private batchProcessor: BatchProcessor

  constructor(
    private readonly candleProvider: ICandleProvider,
    plugins: IRulePlugin[] = [],
    batchSize = 5000,
  ) {
    this.mtf = new MtfContext(candleProvider)
    this.batchProcessor = new BatchProcessor(batchSize)
    if (plugins.length) this.loader.discover(plugins)
  }

  registerPlugin(plugin: IRulePlugin): void {
    this.loader.register(plugin)
  }

  getPlugins(): IRulePlugin[] {
    return this.loader.getAll()
  }

  async scan(options: ScanOptions): Promise<ScanResult> {
    const startTime = performance.now()
    const scanId = randomUUID()
    const debug = options.debug ? new DebugReporter() : null

    const candles = this.candleProvider.getCandles(
      options.symbol,
      options.timeframe,
      options.startDate,
      options.endDate,
    )

    const plugins = sortPluginsByDependencies(
      this.loader.getByNames(options.rules),
    )

    const htf = this.mtf.getHigherTimeframe(options.timeframe)
    const htfCandles = htf
      ? this.mtf.getHtfCandles(options.symbol, options.timeframe, options.startDate, options.endDate)
      : []

    const allEvents: MarketEvent[] = []
    const priorEvents: MarketEvent[] = []
    const warmup = Math.min(50, Math.max(3, Math.floor(candles.length / 4)))
    const slices = this.batchProcessor.slice(candles)

    for (const slice of slices) {
      const batchEvents = await this.scanBatch(
        plugins,
        options.symbol,
        options.timeframe,
        slice.candles,
        slice.startIndex,
        warmup,
        htfCandles,
        htf,
        priorEvents,
        debug,
      )
      allEvents.push(...batchEvents)
      priorEvents.push(...batchEvents)
    }

    let finalEvents = allEvents
    if (options.composeRules) {
      const composed = this.composition.compose(allEvents)
      finalEvents = [...allEvents, ...composed]
    }

    const durationMs = Math.round(performance.now() - startTime)
    this.mtf.clearCache()

    return {
      scanId,
      symbol: options.symbol,
      timeframe: options.timeframe,
      events: finalEvents,
      eventsFound: finalEvents.length,
      durationMs,
      rulesExecuted: plugins.map((p) => p.metadata.name),
      debug: debug?.build(candles.length, durationMs),
    }
  }

  private async scanBatch(
    plugins: IRulePlugin[],
    symbol: string,
    timeframe: string,
    candles: Candle[],
    globalOffset: number,
    warmup: number,
    htfCandles: Candle[],
    htf: string | null,
    priorEvents: MarketEvent[],
    debug: DebugReporter | null,
  ): Promise<MarketEvent[]> {
    const events: MarketEvent[] = []
    const startIdx = globalOffset === 0 ? warmup : 0

    const pluginResults = await Promise.all(
      plugins.map(async (plugin) => {
        const ruleStart = performance.now()
        debug?.startRule(plugin.metadata.id, plugin.metadata.name)
        const ruleEvents: MarketEvent[] = []

        for (let i = startIdx; i < candles.length; i++) {
          const globalIndex = globalOffset + i
          const context: RuleContext = {
            symbol,
            timeframe,
            candles,
            index: i,
            htfCandles: htfCandles.length ? htfCandles : undefined,
            htfTimeframe: htf ?? undefined,
            priorEvents: priorEvents.filter((e) => e.ruleId === plugin.metadata.id),
            parameters: {},
          }

          if (!plugin.validate(context)) {
            debug?.recordRejection(plugin.metadata.id, 'validation_failed')
            continue
          }

          const detections = plugin.detect(context)
          for (const det of detections) {
            const exported = plugin.export(det, context)
            const event: MarketEvent = {
              ...exported,
              id: createEventId(),
              candleIndex: globalIndex,
            }
            ruleEvents.push(event)
            debug?.recordEvent(
              plugin.metadata.id,
              globalIndex,
              event.confidence,
              event.explanation,
            )
          }
        }

        debug?.finishRule(plugin.metadata.id, Math.round(performance.now() - ruleStart))
        return ruleEvents
      }),
    )

    for (const batch of pluginResults) events.push(...batch)
    return events
  }
}
