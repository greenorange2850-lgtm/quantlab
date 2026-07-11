import type { IAnalyzer, AnalysisContext, AnalyzerContribution } from '../types/index.js'

export abstract class BaseAnalyzer implements IAnalyzer {
  abstract readonly name: string
  abstract readonly weight: number

  abstract analyze(context: AnalysisContext): AnalyzerContribution

  protected contribution(
    score: number,
    tags: string[],
    metadata: Record<string, unknown>,
  ): AnalyzerContribution {
    return {
      analyzer: this.name,
      score: Math.min(100, Math.max(0, score)),
      weight: this.weight,
      tags,
      metadata,
    }
  }
}
