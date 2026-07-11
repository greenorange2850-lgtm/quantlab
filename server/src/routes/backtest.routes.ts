import { Router } from 'express'
import { sendSuccess } from '../middleware/response.js'
import type { Repositories } from '@trading-os/database'
import type { EngineRegistry } from '@trading-os/engines'

export function createBacktestRouter(repos: Repositories, engines: EngineRegistry): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    sendSuccess(res, repos.backtests.findAll())
  })

  router.get('/:id', (req, res) => {
    const backtest = repos.backtests.findById(req.params.id)
    if (!backtest) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Backtest not found' } })
      return
    }
    sendSuccess(res, backtest)
  })

  router.get('/:id/trades', (req, res) => {
    sendSuccess(res, repos.backtests.findTrades(req.params.id))
  })

  router.post('/run', async (req, res, next) => {
    try {
      const backtest = await engines.backtest.run(req.body)
      sendSuccess(res, backtest, 201)
    } catch (err) {
      next(err)
    }
  })

  return router
}
