import { randomUUID } from 'node:crypto'
import type { IMarketDataRepository } from '../repositories/market-data.repository.interface.js'
import type { MarketDataSource, ImportResult, ImportProgress } from '../types/index.js'
import { parseCsv } from '../parsers/csv.parser.js'
import { parseMetaTrader } from '../parsers/metatrader.parser.js'
import { parseDukascopy } from '../parsers/dukascopy.parser.js'
import { detectFormat } from '../parsers/detector.js'
import { validateCandles } from '../validators/candle.validator.js'
import { validateDataset, calculateQualityScore } from '../validators/dataset.validator.js'
import { normalizeCandles } from '../normalizers/index.js'
import { normalizeSymbol, normalizeTimeframe } from '../normalizers/candle.normalizer.js'
import { classifySession } from '../engines/session.engine.js'
import { convertTimestamps } from '../engines/timezone.engine.js'
import { logger } from '../utils/logger.js'

type ProgressCallback = (progress: ImportProgress) => void

export class ImportService {
  private readonly repo: IMarketDataRepository

  constructor(repo: IMarketDataRepository) {
    this.repo = repo
  }

  async import(
    source: MarketDataSource,
    symbol: string,
    timeframe: string,
    content: string | Buffer,
    fileName: string | null = null,
    onProgress?: ProgressCallback,
  ): Promise<ImportResult> {
    const normalizedSymbol = normalizeSymbol(symbol)
    const normalizedTf = normalizeTimeframe(timeframe)
    const jobId = randomUUID()
    const startedAt = new Date().toISOString()
    const startMs = performance.now()

    const job = this.repo.createImportJob({
      id: jobId,
      fileName,
      source,
      symbol: normalizedSymbol,
      timeframe: normalizedTf,
      status: 'running',
      rowsImported: 0,
      rowsRejected: 0,
      durationMs: null,
      qualityScore: null,
      startedAt,
      completedAt: null,
      createdAt: startedAt,
    })

    try {
      onProgress?.({ jobId, status: 'running', processed: 0, total: 0, percent: 0 })

      const text = Buffer.isBuffer(content) ? content.toString('utf-8') : content
      const { candles: raw, rowsSkipped, detection } = this.parseSource(source, text)

      logger.info(`Parsed ${raw.length} candles from ${source}`, { fileName, detection })

      const tzConverted = detection.timezone !== 'utc'
        ? raw.map((c) => ({
            ...c,
            timestamp: convertTimestamps([c.timestamp], detection.timezone, 'utc')[0],
          }))
        : raw

      const { valid, rejected, stats } = validateCandles(tzConverted)
      const normalized = normalizeCandles(valid, 'utc')

      const withSessions = normalized.map((c) => ({
        ...c,
        session: classifySession(c.timestamp),
      }))

      const total = raw.length + rowsSkipped
      const batchSize = 5000

      for (let i = 0; i < withSessions.length; i += batchSize) {
        const batch = withSessions.slice(i, i + batchSize)
        this.repo.insertCandlesBatch(normalizedSymbol, normalizedTf, source, batch)
        const processed = Math.min(i + batchSize, withSessions.length)
        onProgress?.({
          jobId,
          status: 'running',
          processed,
          total: withSessions.length,
          percent: Math.round((processed / withSessions.length) * 100),
        })
      }

      const dataset = validateDataset(normalized, normalizedTf, rejected.length + rowsSkipped)
      const qualityScore = calculateQualityScore(
        total,
        normalized.length,
        dataset,
        stats,
      )

      const durationMs = Math.round(performance.now() - startMs)
      const range = this.repo.getRange(normalizedSymbol, normalizedTf)

      const quality = this.repo.saveQualityReport({
        symbol: normalizedSymbol,
        timeframe: normalizedTf,
        qualityScore,
        missingCandles: dataset.missingCandles,
        duplicateCandles: dataset.duplicateCandles,
        invalidOhlc: stats.invalidOhlc,
        negativePrices: stats.negativePrices,
        timezoneIssues: dataset.timezoneIssues,
        weekendGaps: dataset.weekendGaps,
        report: {
          totalRows: total,
          validRows: normalized.length,
          rejectedRows: rejected.length + rowsSkipped,
          dateRange: { start: range.start, end: range.end },
          issues: dataset.issues,
        },
        importJobId: jobId,
      })

      const completedJob = {
        ...job,
        status: 'completed' as const,
        rowsImported: normalized.length,
        rowsRejected: rejected.length + rowsSkipped,
        durationMs,
        qualityScore,
        errors: rejected.slice(0, 100),
        completedAt: new Date().toISOString(),
      }

      this.repo.updateImportJob(jobId, completedJob)
      onProgress?.({ jobId, status: 'completed', processed: normalized.length, total: normalized.length, percent: 100 })

      logger.info(`Import completed: ${normalized.length} candles`, { jobId, qualityScore, durationMs })

      return { job: completedJob, quality }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Import failed: ${message}`, { jobId })

      this.repo.updateImportJob(jobId, {
        status: 'failed',
        errors: [{ row: 0, message }],
        completedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startMs),
      })

      throw err
    }
  }

  private parseSource(source: MarketDataSource, content: string) {
    switch (source) {
      case 'csv':
        return { ...parseCsv(content), detection: detectFormat(content) }
      case 'metatrader':
        return parseMetaTrader(content)
      case 'dukascopy':
        return parseDukascopy(content)
      default:
        return { ...parseCsv(content), detection: detectFormat(content) }
    }
  }

  detectFormat(content: string) {
    return detectFormat(content)
  }
}
