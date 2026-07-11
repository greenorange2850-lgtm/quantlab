import { randomUUID } from 'node:crypto'
import type { MarketEvent } from '@trading-os/rule-engine'
import type {
  AnalysisContext,
  AnalyzeOptions,
  AnalyzeResult,
  EnhancedMarketEvent,
  ICandleSource,
  IAnalyzer,
  IIntelligenceRepository,
  IntelligenceCandle,
} from '../types/index.js'
import { createAnalyzers } from '../analyzers/index.js'
import {
  TrendAnalyzer,
  VolatilityAnalyzer,
  LiquidityAnalyzer,
  SessionAnalyzer,
  SpreadAnalyzer,
  MomentumAnalyzer,
  RangeAnalyzer,
  StructureAnalyzer,
  MtfAnalyzer,
  RiskAnalyzer,
} from '../analyzers/index.js'
import { buildScores } from '../scoring/score.engine.js'
import {
  generateExplanation,
  generateRecommendations,
  collectContextTags,
  buildConditionSnapshot,
} from '../scoring/explanation.generator.js'
import { findCandleIndex } from '../utils/math.js'
import { IntelligenceDebugReporter } from './debug-reporter.js'

const HTF_TFS = ['M15', 'H1', 'H4', 'D1', 'W1', 'MN'] as const

export interface EventSource {
  getEvents(params: {
    symbol: string
    timeframe: string
    scanId?: string
    start?: string
    end?: string
    limit?: number
  }): MarketEvent[]
}

export class IntelligenceEngine {
  private analyzers: IAnalyzer[]
  private typedAnalyzers: {
    trend: TrendAnalyzer
    volatility: VolatilityAnalyzer
    liquidity: LiquidityAnalyzer
    session: SessionAnalyzer
    spread: SpreadAnalyzer
    momentum: MomentumAnalyzer
    range: RangeAnalyzer
    structure: StructureAnalyzer
    mtf: MtfAnalyzer
    risk: RiskAnalyzer
  }

  constructor(
    private readonly candleSource: ICandleSource,
    private readonly eventSource: EventSource,
    analyzers?: IAnalyzer[],
  ) {
    const all = analyzers ?? createAnalyzers()
    this.analyzers = all
    this.typedAnalyzers = {
      trend: all.find((a) => a.name === 'trend') as TrendAnalyzer,
      volatility: all.find((a) => a.name === 'volatility') as VolatilityAnalyzer,
      liquidity: all.find((a) => a.name === 'liquidity') as LiquidityAnalyzer,
      session: all.find((a) => a.name === 'session') as SessionAnalyzer,
      spread: all.find((a) => a.name === 'spread') as SpreadAnalyzer,
      momentum: all.find((a) => a.name === 'momentum') as MomentumAnalyzer,
      range: all.find((a) => a.name === 'range') as RangeAnalyzer,
      structure: all.find((a) => a.name === 'structure') as StructureAnalyzer,
      mtf: all.find((a) => a.name === 'mtf') as MtfAnalyzer,
      risk: all.find((a) => a.name === 'risk') as RiskAnalyzer,
    }
  }

  async analyze(options: AnalyzeOptions): Promise<AnalyzeResult> {
    const startTime = performance.now()
    const analysisId = randomUUID()
    const debug = options.debug ? new IntelligenceDebugReporter() : null

    const candles = this.candleSource.getCandles({
      symbol: options.symbol,
      timeframe: options.timeframe,
      start: options.startDate,
      end: options.endDate,
    })

    const htfCandles = this.loadHtfCandles(options.symbol, options.timeframe)

    let events = this.eventSource.getEvents({
      symbol: options.symbol,
      timeframe: options.timeframe,
      scanId: options.scanId,
      start: options.startDate,
      end: options.endDate,
    })

    if (options.eventIds?.length) {
      const idSet = new Set(options.eventIds)
      events = events.filter((e) => idSet.has(e.id))
    }

    const batchSize = options.batchSize ?? 500
    const enhanced: EnhancedMarketEvent[] = []

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map((event) => this.analyzeEvent(event, candles, htfCandles, events, debug)),
      )
      enhanced.push(...batchResults)
    }

    const durationMs = Math.round(performance.now() - startTime)

    return {
      analysisId,
      symbol: options.symbol,
      timeframe: options.timeframe,
      eventsAnalyzed: enhanced.length,
      enhancedEvents: enhanced,
      durationMs,
      debug: debug?.build(enhanced.length, durationMs),
    }
  }

  private async analyzeEvent(
    event: MarketEvent,
    candles: IntelligenceCandle[],
    htfCandles: Record<string, IntelligenceCandle[]>,
    allEvents: MarketEvent[],
    debug: IntelligenceDebugReporter | null,
  ): Promise<EnhancedMarketEvent> {
    const candleIndex = event.candleIndex ?? findCandleIndex(candles, event.timestamp)
    const windowMs = 3600_000
    const eventTime = new Date(event.timestamp).getTime()
    const relatedEvents = allEvents.filter((e) => {
      if (e.id === event.id) return false
      const gap = Math.abs(new Date(e.timestamp).getTime() - eventTime)
      return gap <= windowMs
    })

    const context: AnalysisContext = {
      event,
      symbol: event.symbol,
      timeframe: event.timeframe,
      candles,
      candleIndex,
      htfCandles,
      relatedEvents,
    }

    const contributions = await Promise.all(
      this.analyzers.map(async (analyzer) => {
        const t0 = performance.now()
        debug?.startEngine(analyzer.name)
        const result = analyzer.analyze(context)
        debug?.recordEngine(analyzer.name, Math.round(performance.now() - t0), result.score, result.tags.length)
        return result
      }),
    )

    const scores = buildScores(contributions, event.confidence)
    const conditions = buildConditionSnapshot(
      this.typedAnalyzers.trend,
      this.typedAnalyzers.volatility,
      this.typedAnalyzers.liquidity,
      this.typedAnalyzers.session,
      this.typedAnalyzers.spread,
      this.typedAnalyzers.momentum,
      this.typedAnalyzers.range,
      this.typedAnalyzers.structure,
      this.typedAnalyzers.mtf,
      this.typedAnalyzers.risk,
      context,
    )

    return {
      event,
      scores,
      conditions,
      contextTags: collectContextTags(contributions),
      recommendations: generateRecommendations(scores, contributions),
      explanation: generateExplanation(scores, contributions, event.ruleName),
      contributions,
      analyzedAt: new Date().toISOString(),
      analysisId: randomUUID(),
    }
  }

  private loadHtfCandles(symbol: string, timeframe: string): Record<string, IntelligenceCandle[]> {
    const result: Record<string, IntelligenceCandle[]> = {}
    for (const tf of HTF_TFS) {
      if (tf === timeframe) continue
      result[tf] = this.candleSource.getCandles({ symbol, timeframe: tf, limit: 500 })
    }
    return result
  }
}
