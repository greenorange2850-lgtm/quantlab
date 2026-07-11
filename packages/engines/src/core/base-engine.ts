import type { EngineStatus } from '@trading-os/shared'

export interface EngineResult<T> {
  success: boolean
  data?: T
  error?: string
  durationMs: number
}

export interface EngineHealth {
  name: string
  status: EngineStatus | 'error'
  lastRun: string | null
  lastError: string | null
}

export abstract class BaseEngine {
  abstract readonly name: string
  protected status: EngineStatus = 'idle'
  protected lastRun: string | null = null
  protected lastError: string | null = null

  getHealth(): EngineHealth {
    return {
      name: this.name,
      status: this.status,
      lastRun: this.lastRun,
      lastError: this.lastError,
    }
  }

  protected async execute<T>(fn: () => Promise<T>): Promise<EngineResult<T>> {
    const start = performance.now()
    this.status = 'running'
    this.lastError = null

    try {
      const data = await fn()
      this.status = 'completed'
      this.lastRun = new Date().toISOString()
      return { success: true, data, durationMs: performance.now() - start }
    } catch (err) {
      this.status = 'failed'
      this.lastError = err instanceof Error ? err.message : String(err)
      this.lastRun = new Date().toISOString()
      return { success: false, error: this.lastError, durationMs: performance.now() - start }
    } finally {
      if (this.status === 'running') this.status = 'idle'
    }
  }
}
