import { Router } from 'express'
import { createMarketIntelligence } from '@trading-os/market-intelligence'
import type { Repositories } from '@trading-os/database'
import { sendSuccess } from '../middleware/response.js'

export function createMarketIntelligenceRouter(repos: Repositories): Router {
  const router = Router()

  const eventSource = {
    getEvents: (params: {
      symbol: string
      timeframe: string
      scanId?: string
      start?: string
      end?: string
      limit?: number
    }) => repos.ruleEngine.getEvents(params),
  }

  const intelligence = createMarketIntelligence(
    repos.marketDataEngine,
    eventSource,
    repos.marketIntelligence,
  )

  router.get('/runs', (req, res) => {
    const { symbol, timeframe, limit } = req.query
    sendSuccess(res, repos.marketIntelligence.getRuns(
      symbol ? String(symbol) : undefined,
      timeframe ? String(timeframe) : undefined,
      limit ? Number(limit) : 20,
    ))
  })

  router.get('/enhanced', (req, res) => {
    const { symbol, timeframe, start, end, limit } = req.query
    if (!symbol || !timeframe) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
      return
    }
    sendSuccess(res, repos.marketIntelligence.getEnhancedEvents({
      symbol: String(symbol),
      timeframe: String(timeframe),
      start: start ? String(start) : undefined,
      end: end ? String(end) : undefined,
      limit: limit ? Number(limit) : 100,
    }))
  })

  router.get('/enhanced/:eventId', (req, res) => {
    const event = repos.marketIntelligence.getEnhancedEvent(req.params.eventId)
    if (!event) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Enhanced event not found' } })
      return
    }
    sendSuccess(res, event)
  })

  router.post('/analyze', async (req, res, next) => {
    try {
      const { symbol, timeframe, eventIds, scanId, startDate, endDate, debug, batchSize } = req.body
      if (!symbol || !timeframe) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
        return
      }

      const result = await intelligence.analyze.analyze({
        symbol,
        timeframe,
        eventIds,
        scanId,
        startDate,
        endDate,
        debug: debug ?? false,
        batchSize,
      })

      sendSuccess(res, result, 201)
    } catch (err) {
      next(err)
    }
  })

  return router
}
