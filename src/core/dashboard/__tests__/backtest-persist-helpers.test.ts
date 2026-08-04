import { describe, expect, it } from 'vitest'
import {
  normalizeTimeframeCode,
  summaryMetricsFromRequest,
  validateCreateBacktestRequest,
} from '../../../../server/src/services/backtest.service.js'

describe('backtest persistence helpers', () => {
  it('normalizes timeframe aliases to seeded codes', () => {
    expect(normalizeTimeframeCode('1h').code).toBe('H1')
    expect(normalizeTimeframeCode('1H').code).toBe('H1')
    expect(normalizeTimeframeCode('H1').code).toBe('H1')
    expect(normalizeTimeframeCode('15m').code).toBe('M15')
    expect(normalizeTimeframeCode('4H').code).toBe('H4')
  })

  it('maps summary fields into StrategyMetrics storage shape', () => {
    const metrics = summaryMetricsFromRequest({
      id: 'bt-1',
      version: 'v1',
      market: 'BTCUSDT',
      timeframe: 'H1',
      trades: 10,
      winRate: 55,
      profitFactor: 1.8,
      maxDrawdown: -8.2,
      netProfit: 420,
    })

    expect(metrics.totalTrades).toBe(10)
    expect(metrics.winRate).toBe(55)
    expect(metrics.maxDrawdown).toBe(-8.2)
  })

  it('rejects incomplete create payloads', () => {
    expect(() => validateCreateBacktestRequest({})).toThrow(/Missing required field/)
    expect(() =>
      validateCreateBacktestRequest({
        id: 'bt-1',
        version: 'v1',
        market: 'BTCUSDT',
        timeframe: 'H1',
        trades: 1,
        winRate: 50,
        profitFactor: 1,
        maxDrawdown: -1,
        netProfit: 10,
      }),
    ).not.toThrow()
  })
})
