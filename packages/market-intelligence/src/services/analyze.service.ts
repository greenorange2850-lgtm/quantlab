import type { AnalyzeOptions, AnalyzeResult, ICandleSource, IIntelligenceRepository } from '../types/index.js'
import { IntelligenceEngine, type EventSource } from '../engine/intelligence-engine.js'

export class AnalyzeService {
  private engine: IntelligenceEngine

  constructor(
    candleSource: ICandleSource,
    eventSource: EventSource,
    private readonly repository: IIntelligenceRepository,
  ) {
    this.engine = new IntelligenceEngine(candleSource, eventSource)
  }

  async analyze(options: AnalyzeOptions): Promise<AnalyzeResult> {
    const result = await this.engine.analyze(options)

    this.repository.createRun({
      id: result.analysisId,
      symbol: result.symbol,
      timeframe: result.timeframe,
      eventsAnalyzed: result.eventsAnalyzed,
      durationMs: result.durationMs,
      debugMode: options.debug ?? false,
    })

    if (result.enhancedEvents.length > 0) {
      this.repository.saveAnalysis(result.enhancedEvents, result.analysisId)
    }

    return result
  }
}
