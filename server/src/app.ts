import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRepositories, migrate, seed } from '@trading-os/database'
import { createEngines } from '@trading-os/engines'
import { API_BASE_PATH } from '@trading-os/shared'
import { config } from './config.js'
import { createApiRouter } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

function resolveStaticDir(): string | null {
  if (!config.serveStatic) return null

  const candidates = [
    config.staticDir,
    path.resolve(process.cwd(), 'dist'),
    path.resolve(moduleDir, '../../../dist'),
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate
    }
  }

  return null
}

export function createApp() {
  migrate()
  seed()

  const repos = createRepositories()
  const engines = createEngines()

  const app = express()
  const staticDir = resolveStaticDir()

  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json())

  app.use(API_BASE_PATH, createApiRouter(repos, engines))

  if (staticDir) {
    app.use(express.static(staticDir, { index: false }))
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'))
    })
  } else {
    app.use(notFoundHandler)
  }

  app.use(errorHandler)

  return app
}
