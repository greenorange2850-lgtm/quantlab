import type {
  CreateStrategyRequest,
  CreateStrategyVersionRequest,
  Strategy,
  StrategyVersion,
} from '@trading-os/shared'
import { BaseEngine } from '../core/base-engine.js'

export interface IStrategyEngine {
  readonly name: string
  create(request: CreateStrategyRequest): Promise<Strategy>
  createVersion(request: CreateStrategyVersionRequest): Promise<StrategyVersion>
  getVersionLineage(versionId: string): Promise<StrategyVersion[]>
  diffVersions(versionA: string, versionB: string): Promise<VersionDiff>
}

export interface VersionDiff {
  rulesAdded: string[]
  rulesRemoved: string[]
  rulesModified: string[]
  filtersChanged: string[]
  metricsDelta: Record<string, number>
}

/**
 * Strategy Engine — version-controlled strategy management.
 * Every change creates a new immutable version (CRT v1 → v2 → v3).
 */
export class StrategyEngine extends BaseEngine implements IStrategyEngine {
  readonly name = 'strategy'

  async create(request: CreateStrategyRequest): Promise<Strategy> {
    const result = await this.execute(async () => ({
      id: `str-${Date.now()}`,
      name: request.name,
      description: request.description,
      status: 'draft' as const,
      currentVersionId: null,
      tags: request.tags ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    if (!result.success || !result.data) throw new Error(result.error ?? 'Create strategy failed')
    return result.data
  }

  async createVersion(request: CreateStrategyVersionRequest): Promise<StrategyVersion> {
    const result = await this.execute(async () => ({
      id: `sv-${Date.now()}`,
      strategyId: request.strategyId,
      version: `v0.0.0`, // auto-incremented by repository
      versionNumber: 0,
      rules: request.rules,
      filters: request.filters,
      metrics: null,
      aiNotes: null,
      parentVersionId: request.parentVersionId ?? null,
      changelog: request.changelog,
      createdAt: new Date().toISOString(),
    }))

    if (!result.success || !result.data) throw new Error(result.error ?? 'Create version failed')
    return result.data
  }

  async getVersionLineage(_versionId: string): Promise<StrategyVersion[]> {
    return []
  }

  async diffVersions(_versionA: string, _versionB: string): Promise<VersionDiff> {
    return {
      rulesAdded: [],
      rulesRemoved: [],
      rulesModified: [],
      filtersChanged: [],
      metricsDelta: {},
    }
  }
}
