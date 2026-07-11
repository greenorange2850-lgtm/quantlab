import type { OptimizationRun, RunOptimizationRequest } from '@trading-os/shared'
import { BaseEngine } from '../core/base-engine.js'

export interface IOptimizationEngine {
  readonly name: string
  optimize(request: RunOptimizationRequest): Promise<OptimizationRun>
  cancel(runId: string): Promise<void>
  getProgress(runId: string): Promise<{ completed: number; total: number }>
}

/**
 * Optimization Engine — parameter sweep and walk-forward analysis.
 */
export class OptimizationEngine extends BaseEngine implements IOptimizationEngine {
  readonly name = 'optimization'

  async optimize(request: RunOptimizationRequest): Promise<OptimizationRun> {
    const result = await this.execute(async () => ({
      id: `opt-${Date.now()}`,
      strategyVersionId: request.strategyVersionId,
      status: 'idle' as const,
      parameters: request.parameters,
      results: [],
      bestResultId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    }))

    if (!result.success || !result.data) throw new Error(result.error ?? 'Optimization failed')
    return result.data
  }

  async cancel(_runId: string): Promise<void> {
    this.status = 'idle'
  }

  async getProgress(_runId: string): Promise<{ completed: number; total: number }> {
    return { completed: 0, total: 0 }
  }
}
