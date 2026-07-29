import express from 'express'
import cors from 'cors'
import { createRepositories, migrate, seed, getDatabase } from '@trading-os/database'
import { createEngines } from '@trading-os/engines'
import { API_BASE_PATH, APP_VERSION } from '@trading-os/shared'
import { config } from './config.js'
import { createCorsOptions } from './cors.js'
import { createApiRouter } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

export function createApp() {
  getDatabase({ path: config.databasePath })
  migrate()
  seed()

  const repos = createRepositories()
  const engines = createEngines()

  const app = express()

  app.use(cors(createCorsOptions()))
  app.use(express.json())

  // Railway / load-balancer healthcheck (keep /api/v1/health unchanged)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    })
  })

  app.use(API_BASE_PATH, createApiRouter(repos, engines))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
