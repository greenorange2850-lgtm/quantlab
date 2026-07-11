import { Router } from 'express'
import { sendSuccess } from '../middleware/response.js'
import type { Repositories } from '@trading-os/database'
import type { EngineRegistry } from '@trading-os/engines'

export function createAiRouter(_repos: Repositories, engines: EngineRegistry): Router {
  const router = Router()

  router.post('/analyze', async (req, res, next) => {
    try {
      const analysis = await engines.ai.analyze(req.body)
      sendSuccess(res, analysis, 201)
    } catch (err) {
      next(err)
    }
  })

  return router
}

export function createKnowledgeRouter(repos: Repositories): Router {
  const router = Router()

  router.get('/', (req, res) => {
    const category = req.query.category as string | undefined
    sendSuccess(res, repos.knowledge.findAll(category))
  })

  return router
}

export function createOptimizationRouter(engines: EngineRegistry): Router {
  const router = Router()

  router.post('/run', async (req, res, next) => {
    try {
      const run = await engines.optimization.optimize(req.body)
      sendSuccess(res, run, 201)
    } catch (err) {
      next(err)
    }
  })

  return router
}
