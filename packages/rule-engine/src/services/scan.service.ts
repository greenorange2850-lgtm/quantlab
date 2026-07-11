import type { ScanOptions, ScanResult, IEventRepository, ICandleProvider } from '../types/index.js'
import { RuleEngine } from '../engine/rule-engine.js'
import { EventEngine } from '../engine/event-engine.js'
import type { IRulePlugin } from '../types/index.js'

export class ScanService {
  private ruleEngine: RuleEngine
  private eventEngine: EventEngine

  constructor(
    candleProvider: ICandleProvider,
    eventRepository: IEventRepository,
    plugins: IRulePlugin[],
    batchSize = 5000,
  ) {
    this.ruleEngine = new RuleEngine(candleProvider, plugins, batchSize)
    this.eventEngine = new EventEngine(eventRepository)
  }

  async scan(options: ScanOptions): Promise<ScanResult> {
    const result = await this.ruleEngine.scan(options)

    this.eventEngine.recordScan({
      id: result.scanId,
      symbol: result.symbol,
      timeframe: result.timeframe,
      rules: result.rulesExecuted,
      eventsFound: result.eventsFound,
      durationMs: result.durationMs,
      debugMode: options.debug ?? false,
    })

    if (result.events.length > 0) {
      this.eventEngine.persist(result.events, result.scanId)
    }

    return result
  }

  getPlugins() {
    return this.ruleEngine.getPlugins()
  }
}
