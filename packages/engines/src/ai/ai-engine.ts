import type {
  AiAnalysis,
  AiSuggestion,
  AiWeakness,
  RunAiAnalysisRequest,
  StrategyVersion,
} from '@trading-os/shared'
import { BaseEngine } from '../core/base-engine.js'

export interface IAiAnalysisEngine {
  readonly name: string
  analyze(request: RunAiAnalysisRequest): Promise<AiAnalysis>
  discoverWeaknesses(version: StrategyVersion, backtestId?: string): Promise<AiWeakness[]>
  recommendImprovements(weaknesses: AiWeakness[]): Promise<AiSuggestion[]>
  proposeVersion(version: StrategyVersion, suggestions: AiSuggestion[]): Promise<StrategyVersion>
}

/**
 * AI Analysis Engine — analyzes existing strategies, never invents from scratch.
 * Discovers weaknesses, recommends measurable improvements, creates new versions.
 */
export class AiAnalysisEngine extends BaseEngine implements IAiAnalysisEngine {
  readonly name = 'ai'

  async analyze(request: RunAiAnalysisRequest): Promise<AiAnalysis> {
    const result = await this.execute(async () => ({
      id: `ai-${Date.now()}`,
      strategyVersionId: request.strategyVersionId,
      backtestId: request.backtestId ?? null,
      confidence: 0,
      reasoning: 'AI engine ready — awaiting backtest data for analysis.',
      suggestions: [],
      weaknesses: [],
      proposedVersionId: null,
      createdAt: new Date().toISOString(),
    }))

    if (!result.success || !result.data) throw new Error(result.error ?? 'AI analysis failed')
    return result.data
  }

  async discoverWeaknesses(_version: StrategyVersion, _backtestId?: string): Promise<AiWeakness[]> {
    return []
  }

  async recommendImprovements(_weaknesses: AiWeakness[]): Promise<AiSuggestion[]> {
    return []
  }

  async proposeVersion(
    version: StrategyVersion,
    _suggestions: AiSuggestion[],
  ): Promise<StrategyVersion> {
    return {
      ...version,
      id: `sv-ai-${Date.now()}`,
      versionNumber: version.versionNumber + 1,
      parentVersionId: version.id,
      aiNotes: 'Proposed by AI analysis engine',
      createdAt: new Date().toISOString(),
    }
  }
}
