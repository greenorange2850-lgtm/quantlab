import type { Repositories } from '@trading-os/database'
import type {
  Backtest,
  BacktestSummary,
  CreateBacktestRequest,
  StrategyMetrics,
} from '@trading-os/shared'

const TIMEFRAME_ALIASES: Record<string, { code: string; minutes: number; label: string }> = {
  M15: { code: 'M15', minutes: 15, label: '15 Minutes' },
  '15M': { code: 'M15', minutes: 15, label: '15 Minutes' },
  H1: { code: 'H1', minutes: 60, label: '1 Hour' },
  '1H': { code: 'H1', minutes: 60, label: '1 Hour' },
  '60': { code: 'H1', minutes: 60, label: '1 Hour' },
  H4: { code: 'H4', minutes: 240, label: '4 Hours' },
  '4H': { code: 'H4', minutes: 240, label: '4 Hours' },
  D1: { code: 'D1', minutes: 1440, label: 'Daily' },
  '1D': { code: 'D1', minutes: 1440, label: 'Daily' },
}

/** Normalize client timeframe labels (1h, 1H, H1) to seeded codes. */
export function normalizeTimeframeCode(raw: string): { code: string; minutes: number; label: string } {
  const key = raw.trim().toUpperCase()
  return (
    TIMEFRAME_ALIASES[key] ?? {
      code: key,
      minutes: 60,
      label: key,
    }
  )
}

export function summaryMetricsFromRequest(request: CreateBacktestRequest): StrategyMetrics {
  return {
    totalTrades: request.trades,
    winRate: request.winRate,
    profitFactor: request.profitFactor,
    maxDrawdown: request.maxDrawdown,
    netProfit: request.netProfit,
    averageRR: 0,
    expectedValue: 0,
    sharpeRatio: 0,
    recoveryFactor: 0,
    maxWinStreak: 0,
    maxLossStreak: 0,
  }
}

export function validateCreateBacktestRequest(body: unknown): CreateBacktestRequest {
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('Request body is required'), { status: 400, code: 'VALIDATION_ERROR' })
  }

  const req = body as Partial<CreateBacktestRequest>
  const required: Array<keyof CreateBacktestRequest> = [
    'id',
    'version',
    'market',
    'timeframe',
    'trades',
    'winRate',
    'profitFactor',
    'maxDrawdown',
    'netProfit',
  ]

  for (const field of required) {
    if (req[field] === undefined || req[field] === null || req[field] === '') {
      throw Object.assign(new Error(`Missing required field: ${field}`), {
        status: 400,
        code: 'VALIDATION_ERROR',
      })
    }
  }

  if (typeof req.trades !== 'number' || typeof req.winRate !== 'number') {
    throw Object.assign(new Error('Numeric metric fields must be numbers'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    })
  }

  return req as CreateBacktestRequest
}

/**
 * Persist a completed BacktestSummary into the existing `backtests` table.
 * Resolves FK references without a second history store.
 */
export function persistBacktestSummary(
  repos: Repositories,
  request: CreateBacktestRequest,
): BacktestSummary {
  const timeframe = normalizeTimeframeCode(request.timeframe)
  const symbolId = repos.marketData.ensureSymbol(request.market)
  const timeframeId = repos.marketData.ensureTimeframe(
    timeframe.code,
    timeframe.minutes,
    timeframe.label,
  )
  const strategyVersionId = repos.strategies.ensureVersion(
    request.strategyName?.trim() || 'Untitled Strategy',
    request.version,
  )

  const date = request.date ?? new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()
  const createdAt = request.date ? `${date}T00:00:00.000Z` : now

  const record: Backtest = {
    id: request.id,
    strategyVersionId,
    symbolId,
    timeframeId,
    status: request.status ?? 'completed',
    startDate: request.startDate ?? date,
    endDate: request.endDate ?? date,
    initialCapital: request.initialCapital ?? 10_000,
    metrics: summaryMetricsFromRequest(request),
    equityCurve: request.equityCurve ?? [],
    createdAt,
    completedAt: now,
  }

  return repos.backtests.create(record)
}

export function listBacktestSummaries(repos: Repositories, limit = 50): BacktestSummary[] {
  return repos.backtests.findAll(limit)
}
