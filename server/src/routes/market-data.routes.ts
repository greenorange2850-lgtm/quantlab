import { Router } from 'express'
import multer from 'multer'
import { createMarketDataEngine } from '@trading-os/market-data'
import type { MarketDataSource } from '@trading-os/market-data'
import type { Repositories } from '@trading-os/database'
import { sendSuccess } from '../middleware/response.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

const VALID_SOURCES: MarketDataSource[] = ['csv', 'metatrader', 'dukascopy', 'sqlite']

export function createMarketDataRouter(repos: Repositories): Router {
  const router = Router()
  const engine = createMarketDataEngine(repos.marketDataEngine)

  router.get('/symbols', (_req, res) => {
    sendSuccess(res, engine.query.getSymbols())
  })

  router.get('/timeframes', (_req, res) => {
    sendSuccess(res, engine.query.getTimeframes())
  })

  router.get('/sessions', (_req, res) => {
    sendSuccess(res, engine.query.getSessions())
  })

  router.get('/range', (req, res) => {
    const { symbol, timeframe } = req.query
    if (!symbol || !timeframe) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
      return
    }
    sendSuccess(res, engine.query.getRange(String(symbol), String(timeframe)))
  })

  router.get('/candles', (req, res) => {
    const { symbol, timeframe, start, end, limit, offset } = req.query
    if (!symbol || !timeframe) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
      return
    }
    sendSuccess(res, engine.query.getCandles({
      symbol: String(symbol),
      timeframe: String(timeframe),
      start: start ? String(start) : undefined,
      end: end ? String(end) : undefined,
      limit: limit ? Number(limit) : 1000,
      offset: offset ? Number(offset) : 0,
    }))
  })

  router.get('/latest', (req, res) => {
    const { symbol, timeframe } = req.query
    if (!symbol || !timeframe) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
      return
    }
    sendSuccess(res, engine.query.getLatest(String(symbol), String(timeframe)))
  })

  router.get('/quality', (req, res) => {
    const { symbol, timeframe } = req.query
    if (!symbol || !timeframe) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'symbol and timeframe required' } })
      return
    }
    sendSuccess(res, engine.query.getQualityReport(String(symbol), String(timeframe)))
  })

  router.get('/imports', (_req, res) => {
    sendSuccess(res, engine.query.getImportHistory())
  })

  router.post('/detect', upload.single('file'), (req, res) => {
    const content = req.file?.buffer?.toString('utf-8') ?? ''
    sendSuccess(res, engine.import.detectFormat(content))
  })

  router.post('/import', upload.single('file'), async (req, res, next) => {
    try {
      const { source, symbol, timeframe } = req.body
      if (!source || !symbol || !timeframe) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'source, symbol, timeframe required' } })
        return
      }
      if (!VALID_SOURCES.includes(source)) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: `Invalid source: ${source}` } })
        return
      }
      const content = req.file?.buffer
      if (!content) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'File required' } })
        return
      }

      const result = await engine.import.import(
        source as MarketDataSource,
        symbol,
        timeframe,
        content,
        req.file?.originalname ?? null,
      )

      engine.query.invalidateCache(symbol, timeframe)
      sendSuccess(res, result, 201)
    } catch (err) {
      next(err)
    }
  })

  return router
}
