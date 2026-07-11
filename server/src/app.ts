import express from 'express'
import cors from 'cors'
import { createRepositories, migrate, seed } from '@trading-os/database'
import { createEngines } from '@trading-os/engines'
import { API_BASE_PATH } from '@trading-os/shared'
import { config } from './config.js'
import { createApiRouter } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

export function createApp() {
  migrate()
  seed()

  const repos = createRepositories()
  const engines = createEngines()

  const app = express()

  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json())

  app.use(API_BASE_PATH, createApiRouter(repos, engines))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
