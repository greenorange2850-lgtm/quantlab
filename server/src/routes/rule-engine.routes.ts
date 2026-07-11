import { Router } from 'express'
import { createRuleEngine } from '@trading-os/rule-engine'
import type { Repositories } from '@trading-os/database'
import { sendSuccess } from '../middleware/response.js'

export function createRuleEngineRouter(repos: Repositories): Router {
  const router = Router()

  const engine = createRuleEngine(repos.marketDataEngine, repos.ruleEngine)

  router.get('/plugins', (_req, res) => {
    sendSuccess(res, engine.plugins.map((p) => p.metadata))
  })

  router.get('/definitions', (_req, res) => {
    sendSuccess(res, repos.ruleEngine.getRuleDefinitions())
  })

  router.get('/scans', (req, res) => {
    const { symbol, timeframe, limit } = req.query
    sendSuccess(res, repos.ruleEngine.getScans(
      symbol ? String(symbol) : undefined,
      timeframe ? String(timeframe) : undefined,
      limit ? Number(limit) : 20,
    ))
  })

  router.get('/events', (req, res) => {
    const { symbol, timeframe, ruleName, start, end, limit } = req.query
    if (!symbol || !timeframe) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
      return
    }
    sendSuccess(res, repos.ruleEngine.getEvents({
      symbol: String(symbol),
      timeframe: String(timeframe),
      ruleName: ruleName ? String(ruleName) : undefined,
      start: start ? String(start) : undefined,
      end: end ? String(end) : undefined,
      limit: limit ? Number(limit) : 500,
    }))
  })

  router.get('/events/:id', (req, res) => {
    const event = repos.ruleEngine.getEventById(req.params.id)
    if (!event) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } })
      return
    }
    sendSuccess(res, event)
  })

  router.get('/events/:id/replay', (req, res) => {
    const frame = engine.replay.replay(req.params.id)
    if (!frame) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } })
      return
    }
    sendSuccess(res, frame)
  })

  router.post('/scan', async (req, res, next) => {
    try {
      const { symbol, timeframe, rules, startDate, endDate, debug, composeRules, batchSize } = req.body
      if (!symbol || !timeframe) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
        return
      }

      const result = await engine.scan.scan({
        symbol,
        timeframe,
        rules,
        startDate,
        endDate,
        debug: debug ?? false,
        composeRules: composeRules ?? false,
        batchSize,
      })

      sendSuccess(res, result, 201)
    } catch (err) {
      next(err)
    }
  })

  router.post('/replay', (req, res) => {
    const { symbol, timeframe, start, end, ruleName, limit } = req.body
    if (!symbol || !timeframe) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
      return
    }
    sendSuccess(res, engine.replay.replayRange({ symbol, timeframe, start, end, ruleName, limit }))
  })

  return router
}
