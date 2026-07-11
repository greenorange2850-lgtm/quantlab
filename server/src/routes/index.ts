import { Router } from 'express'
import type { Repositories } from '@trading-os/database'
import type { EngineRegistry } from '@trading-os/engines'
import { APP_VERSION } from '@trading-os/shared'
import { getDatabasePath } from '@trading-os/database'
import { dashboardRouter } from './dashboard.routes.js'
import { createStrategyRouter } from './strategy.routes.js'
import { createBacktestRouter } from './backtest.routes.js'
import { createMarketDataRouter } from './market-data.routes.js'
import { createRuleEngineRouter } from './rule-engine.routes.js'
import { createMarketIntelligenceRouter } from './market-intelligence.routes.js'
import { createAiRouter, createKnowledgeRouter, createOptimizationRouter } from './engine.routes.js'

export function createApiRouter(repos: Repositories, engines: EngineRegistry): Router {
  const router = Router()

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: APP_VERSION,
      engines: Object.fromEntries(
        Object.entries(engines).map(([key, engine]) => [key, engine.getHealth()]),
      ),
      database: { connected: true, path: getDatabasePath() },
    })
  })

  router.use('/dashboard', dashboardRouter)
  router.use('/strategies', createStrategyRouter(repos))
  router.use('/backtests', createBacktestRouter(repos, engines))
  router.use('/market-data', createMarketDataRouter(repos))
  router.use('/rules', createRuleEngineRouter(repos))
  router.use('/intelligence', createMarketIntelligenceRouter(repos))
  router.use('/ai', createAiRouter(repos, engines))
  router.use('/knowledge', createKnowledgeRouter(repos))
  router.use('/optimization', createOptimizationRouter(engines))

  return router
}
