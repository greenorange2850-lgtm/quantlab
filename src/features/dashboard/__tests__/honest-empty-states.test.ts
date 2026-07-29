import { describe, expect, it } from 'vitest'
import { hasAiRecommendation } from '../AiRecommendationPanel'
import { hasMarketContext } from '../MarketContextPanel'
import { hasWatchlistItems } from '../WatchlistPanel'

describe('dashboard honest empty-state detection', () => {
  it('treats null AI recommendation as unavailable', () => {
    expect(hasAiRecommendation(null)).toBe(false)
    expect(hasAiRecommendation(undefined)).toBe(false)
    expect(
      hasAiRecommendation({
        suggestions: [],
        confidence: 0,
        reasoning: '',
      }),
    ).toBe(false)
  })

  it('detects a real AI recommendation payload', () => {
    expect(
      hasAiRecommendation({
        suggestions: [{ id: '1', text: 'Tighten stop', type: 'add' }],
        confidence: 72,
        reasoning: 'Based on recent drawdown.',
      }),
    ).toBe(true)
  })

  it('treats null market context as unavailable', () => {
    expect(hasMarketContext(null)).toBe(false)
    expect(hasMarketContext(undefined)).toBe(false)
  })

  it('detects a real market context payload', () => {
    expect(
      hasMarketContext({
        newsSentiment: 55,
        fearGreed: 48,
        volatility: 12.5,
        upcomingEvents: [],
        liquidityStatus: 'medium',
        marketSession: 'London',
        currentSpread: 1.2,
      }),
    ).toBe(true)
  })

  it('treats an empty watchlist as unavailable', () => {
    expect(hasWatchlistItems([])).toBe(false)
    expect(hasWatchlistItems(null)).toBe(false)
    expect(hasWatchlistItems(undefined)).toBe(false)
  })

  it('detects watchlist symbols', () => {
    expect(
      hasWatchlistItems([
        {
          symbol: 'BTCUSDT',
          price: 42_000,
          dailyChange: 1.2,
          trend: 'bullish',
          signal: 'buy',
        },
      ]),
    ).toBe(true)
  })
})
