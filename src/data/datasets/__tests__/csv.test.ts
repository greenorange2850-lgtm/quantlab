import { describe, expect, it } from 'vitest'
import {
  buildImportPreview,
  CsvValidationError,
  detectSymbolFromFilename,
  detectTimeframeFromFilename,
  parseOhlcvCsv,
  parseTimestamp,
  validateOhlc,
} from '../csv.js'
import type { Candle } from '../../candles.js'

describe('timeframe detection', () => {
  it('detects timeframe tokens from common CSV filenames', () => {
    expect(detectTimeframeFromFilename('XAU_15m_data.csv')).toBe('15m')
    expect(detectTimeframeFromFilename('XAU_1h_data.csv')).toBe('1h')
    expect(detectTimeframeFromFilename('XAU_4h_data.csv')).toBe('4h')
    expect(detectTimeframeFromFilename('XAU_1d_data.csv')).toBe('1d')
    expect(detectTimeframeFromFilename('BTCUSDT-1h.csv')).toBe('1h')
    expect(detectTimeframeFromFilename('EURUSD.M15.csv')).toBe('15m')
    expect(detectTimeframeFromFilename('gold_daily_export.csv')).toBe('1d')
  })

  it('returns null when timeframe cannot be inferred', () => {
    expect(detectTimeframeFromFilename('prices.csv')).toBeNull()
  })
})

describe('symbol detection', () => {
  it('extracts symbol from filename prefixes', () => {
    expect(detectSymbolFromFilename('XAU_15m_data.csv')).toBe('XAU')
    expect(detectSymbolFromFilename('XAUUSD_1h.csv')).toBe('XAUUSD')
    expect(detectSymbolFromFilename('BTCUSDT-4h.csv')).toBe('BTCUSDT')
  })
})

describe('timestamp parsing', () => {
  it('parses ISO, space-separated, and epoch timestamps', () => {
    expect(parseTimestamp('2024-01-01T00:00:00.000Z')).toBe(Date.parse('2024-01-01T00:00:00.000Z'))
    expect(parseTimestamp('2024-01-01 00:00:00')).toBe(Date.parse('2024-01-01T00:00:00.000Z'))
    expect(parseTimestamp('1704067200')).toBe(1_704_067_200_000)
    expect(parseTimestamp('1704067200000')).toBe(1_704_067_200_000)
  })
})

describe('OHLC parsing and validation', () => {
  const sampleCsv = [
    'timestamp,open,high,low,close,volume',
    '2024-01-01T00:00:00.000Z,100,110,90,105,1000',
    '2024-01-01T01:00:00.000Z,105,115,100,110,1100',
  ].join('\n')

  it('parses OHLCV rows into Candle[]', async () => {
    const { candles, warnings } = await parseOhlcvCsv(sampleCsv)
    expect(warnings).toEqual([])
    expect(candles).toHaveLength(2)
    expect(candles[0]).toEqual({
      time: Date.parse('2024-01-01T00:00:00.000Z'),
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1000,
    })
  })

  it('allows missing volume column', async () => {
    const csv = [
      'time,open,high,low,close',
      '2024-01-01T00:00:00.000Z,1,2,0.5,1.5',
    ].join('\n')
    const { candles } = await parseOhlcvCsv(csv)
    expect(candles[0]!.volume).toBe(0)
  })

  it('rejects missing required columns with a friendly message', async () => {
    const csv = 'timestamp,open,close\n2024-01-01,1,1'
    await expect(parseOhlcvCsv(csv)).rejects.toBeInstanceOf(CsvValidationError)
    await expect(parseOhlcvCsv(csv)).rejects.toThrow(/Missing required columns/)
  })

  it('rejects invalid timestamps', async () => {
    const csv = [
      'timestamp,open,high,low,close',
      'not-a-date,1,2,0.5,1.5',
    ].join('\n')
    await expect(parseOhlcvCsv(csv)).rejects.toThrow(/invalid timestamp/)
  })

  it('rejects invalid OHLC relationships', () => {
    const bad: Candle = { time: 1, open: 10, high: 9, low: 8, close: 9, volume: 1 }
    expect(() => validateOhlc(bad, 2)).toThrow(/high/)
  })

  it('builds a multi-file import preview', async () => {
    const a = await parseOhlcvCsv(sampleCsv)
    const b = await parseOhlcvCsv(
      [
        'timestamp,open,high,low,close,volume',
        '2024-01-01T00:00:00.000Z,100,110,90,105,10',
      ].join('\n'),
    )

    const preview = buildImportPreview([
      {
        fileName: 'XAU_1h_data.csv',
        fileSize: 100,
        symbol: 'XAU',
        timeframe: '1h',
        rowCount: a.candles.length,
        startDate: a.candles[0]!.time,
        endDate: a.candles.at(-1)!.time,
        candles: a.candles,
        warnings: [],
      },
      {
        fileName: 'XAU_4h_data.csv',
        fileSize: 50,
        symbol: 'XAU',
        timeframe: '4h',
        rowCount: b.candles.length,
        startDate: b.candles[0]!.time,
        endDate: b.candles.at(-1)!.time,
        candles: b.candles,
        warnings: [],
      },
    ])

    expect(preview.timeframes).toEqual(['1h', '4h'])
    expect(preview.suggestedSymbol).toBe('XAU')
    expect(preview.totalRows).toBe(3)
  })

  it('rejects duplicate timeframes across files', () => {
    expect(() =>
      buildImportPreview([
        {
          fileName: 'a_1h.csv',
          fileSize: 1,
          symbol: 'XAU',
          timeframe: '1h',
          rowCount: 1,
          startDate: 1,
          endDate: 2,
          candles: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }],
          warnings: [],
        },
        {
          fileName: 'b_1h.csv',
          fileSize: 1,
          symbol: 'XAU',
          timeframe: '1h',
          rowCount: 1,
          startDate: 1,
          endDate: 2,
          candles: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }],
          warnings: [],
        },
      ]),
    ).toThrow(/Duplicate timeframe/)
  })
})
