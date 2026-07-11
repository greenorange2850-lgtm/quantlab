import { Router } from 'express'
import { sendSuccess } from '../middleware/response.js'
import type { Repositories } from '@trading-os/database'

export function createStrategyRouter(repos: Repositories): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    sendSuccess(res, repos.strategies.findAll())
  })

  router.get('/:id', (req, res) => {
    const strategy = repos.strategies.findById(req.params.id)
    if (!strategy) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Strategy not found' } })
      return
    }
    sendSuccess(res, strategy)
  })

  router.get('/:id/versions', (req, res) => {
    sendSuccess(res, repos.strategies.findVersions(req.params.id))
  })

  return router
}
