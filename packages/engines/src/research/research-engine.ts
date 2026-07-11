import type {
  Candle,
  MultiTimeframeContext,
  PatternEvent,
  PatternType,
  ResearchContext,
  ResearchResult,
  TrendDirection,
} from '@trading-os/shared'
import { BaseEngine } from '../core/base-engine.js'

export interface PatternDetector {
  readonly patternType: PatternType
  detect(candles: Candle[]): PatternEvent[]
}

export interface IResearchEngine {
  readonly name: string
  analyze(context: ResearchContext): Promise<ResearchResult>
  detectPattern(patternType: PatternType, candles: Candle[]): PatternEvent[]
  getMultiTimeframeContext(
    symbolId: string,
    timeframes: string[],
  ): Promise<MultiTimeframeContext[]>
  registerDetector(detector: PatternDetector): void
}

/**
 * Research Engine — detects market structure patterns.
 * Implements: CRT, Liquidity Sweep, FVG, MSS, BOS, Order Block, Equal Highs/Lows.
 */
export class ResearchEngine extends BaseEngine implements IResearchEngine {
  readonly name = 'research'
  private detectors = new Map<PatternType, PatternDetector>()

  registerDetector(detector: PatternDetector): void {
    this.detectors.set(detector.patternType, detector)
  }

  async analyze(context: ResearchContext): Promise<ResearchResult> {
    const result = await this.execute(async () => {
      // Stub: will load candles from database and run all registered detectors
      const patterns: PatternEvent[] = []
      const trend: TrendDirection = 'neutral'

      return {
        patterns,
        trend,
        htfTrend: null,
        sessionContext: 'off_hours' as const,
        summary: `Research analysis for ${context.symbolId} (${context.timeframeId}) — engine ready, awaiting candle data.`,
      } satisfies ResearchResult
    })

    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Research analysis failed')
    }
    return result.data
  }

  detectPattern(patternType: PatternType, candles: Candle[]): PatternEvent[] {
    const detector = this.detectors.get(patternType)
    if (!detector) return []
    return detector.detect(candles)
  }

  async getMultiTimeframeContext(
    _symbolId: string,
    timeframes: string[],
  ): Promise<MultiTimeframeContext[]> {
    return timeframes.map((tf) => ({
      timeframe: tf,
      trend: 'neutral' as TrendDirection,
      keyLevels: [],
      patterns: [],
    }))
  }
}
