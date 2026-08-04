import { describe, expect, it } from 'vitest'
import {
  buildImportPreview,
  CsvValidationError,
  detectDelimiter,
  detectSymbolFromFilename,
  detectTimeframeFromFilename,
  normalizeHeader,
  parseDelimitedLine,
  parseOhlcvCsv,
  parseTimestamp,
  resolveColumnMap,
  validateOhlc,
} from '../csv.js'
import type { Candle } from '../../candles.js'
import type { CsvColumnMapping, CsvImportFilePreview } from '../types.js'

const defaultMapping: CsvColumnMapping = {
  timestamp: 'timestamp',
  open: 'open',
  high: 'high',
  low: 'low',
  close: 'close',
  volume: 'volume',
}

function previewFixture(
  partial: Omit<CsvImportFilePreview, 'delimiter' | 'delimiterLabel' | 'columnMapping' | 'warnings'> &
    Partial<Pick<CsvImportFilePreview, 'delimiter' | 'delimiterLabel' | 'columnMapping' | 'warnings'>>,
): CsvImportFilePreview {
  return {
    warnings: [],
    delimiter: ',',
    delimiterLabel: 'Comma',
    columnMapping: defaultMapping,
    ...partial,
  }
}

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

describe('delimiter detection', () => {
  it('detects comma, semicolon, and tab from the first non-empty line', () => {
    expect(detectDelimiter('Date,Open,High,Low,Close,Volume\n1,2,3,4,5,6')).toBe(',')
    expect(detectDelimiter('Date;Open;High;Low;Close;Volume\n1;2;3;4;5;6')).toBe(';')
    expect(detectDelimiter('Date\tOpen\tHigh\tLow\tClose\tVolume\n1\t2\t3\t4\t5\t6')).toBe('\t')
  })

  it('skips blank leading lines when detecting', () => {
    expect(detectDelimiter('\n\n  \nDate;Open;High;Low;Close\n1;2;3;4;5')).toBe(';')
  })

  it('ignores delimiters inside quotes', () => {
    expect(detectDelimiter('"a,b,c";Open;High;Low;Close\n1;2;3;4;5')).toBe(';')
  })

  it('parses semicolon-separated headers into columns', () => {
    expect(parseDelimitedLine('Date;Open;High;Low;Close;Volume', ';')).toEqual([
      'Date',
      'Open',
      'High',
      'Low',
      'Close',
      'Volume',
    ])
  })
})

describe('flexible header aliases', () => {
  it('trims whitespace and normalizes underscores', () => {
    expect(normalizeHeader('  Open_Price  ')).toBe('open price')
    expect(normalizeHeader('DATE')).toBe('date')
  })

  it('maps Date/Open_Price/Close_Price/Vol aliases', () => {
    const { mapping } = resolveColumnMap([
      ' Date ',
      'Open_Price',
      'High',
      'Low',
      'Close_Price',
      'Vol',
    ])
    expect(mapping).toEqual({
      timestamp: 'Date',
      open: 'Open_Price',
      high: 'High',
      low: 'Low',
      close: 'Close_Price',
      volume: 'Vol',
    })
  })
})

describe('OHLC parsing and validation', () => {
  const sampleCsv = [
    'timestamp,open,high,low,close,volume',
    '2024-01-01T00:00:00.000Z,100,110,90,105,1000',
    '2024-01-01T01:00:00.000Z,105,115,100,110,1100',
  ].join('\n')

  it('parses OHLCV rows into Candle[]', async () => {
    const { candles, warnings, delimiter, columnMapping } = await parseOhlcvCsv(sampleCsv)
    expect(warnings).toEqual([])
    expect(delimiter).toBe(',')
    expect(columnMapping.timestamp).toBe('timestamp')
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

  it('parses semicolon-delimited MetaTrader-style exports', async () => {
    const csv = [
      'Date;Open;High;Low;Close;Volume',
      '2024-01-01T00:00:00.000Z;100;110;90;105;1000',
      '2024-01-01T01:00:00.000Z;105;115;100;110;1100',
    ].join('\n')

    const result = await parseOhlcvCsv(csv)
    expect(result.delimiter).toBe(';')
    expect(result.delimiterLabel).toBe('Semicolon')
    expect(result.columnMapping).toEqual({
      timestamp: 'Date',
      open: 'Open',
      high: 'High',
      low: 'Low',
      close: 'Close',
      volume: 'Volume',
    })
    expect(result.candles).toHaveLength(2)
    expect(result.candles[0]!.close).toBe(105)
  })

  it('parses tab-delimited files with open_price / close_price aliases', async () => {
    const csv = [
      'datetime\topen_price\thigh\tlow\tclose_price\tvol',
      '2024-01-01T00:00:00.000Z\t10\t12\t9\t11\t50',
    ].join('\n')

    const result = await parseOhlcvCsv(csv)
    expect(result.delimiter).toBe('\t')
    expect(result.delimiterLabel).toBe('Tab')
    expect(result.columnMapping).toEqual({
      timestamp: 'datetime',
      open: 'open_price',
      high: 'high',
      low: 'low',
      close: 'close_price',
      volume: 'vol',
    })
    expect(result.candles[0]).toMatchObject({ open: 10, close: 11, volume: 50 })
  })

  it('allows missing volume column', async () => {
    const csv = [
      'time,open,high,low,close',
      '2024-01-01T00:00:00.000Z,1,2,0.5,1.5',
    ].join('\n')
    const { candles, columnMapping } = await parseOhlcvCsv(csv)
    expect(candles[0]!.volume).toBe(0)
    expect(columnMapping.volume).toBeNull()
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
      previewFixture({
        fileName: 'XAU_1h_data.csv',
        fileSize: 100,
        symbol: 'XAU',
        timeframe: '1h',
        rowCount: a.candles.length,
        startDate: a.candles[0]!.time,
        endDate: a.candles.at(-1)!.time,
        candles: a.candles,
        delimiter: a.delimiter,
        delimiterLabel: a.delimiterLabel,
        columnMapping: a.columnMapping,
      }),
      previewFixture({
        fileName: 'XAU_4h_data.csv',
        fileSize: 50,
        symbol: 'XAU',
        timeframe: '4h',
        rowCount: b.candles.length,
        startDate: b.candles[0]!.time,
        endDate: b.candles.at(-1)!.time,
        candles: b.candles,
        delimiter: b.delimiter,
        delimiterLabel: b.delimiterLabel,
        columnMapping: b.columnMapping,
      }),
    ])

    expect(preview.timeframes).toEqual(['1h', '4h'])
    expect(preview.suggestedSymbol).toBe('XAU')
    expect(preview.totalRows).toBe(3)
  })

  it('rejects duplicate timeframes across files', () => {
    expect(() =>
      buildImportPreview([
        previewFixture({
          fileName: 'a_1h.csv',
          fileSize: 1,
          symbol: 'XAU',
          timeframe: '1h',
          rowCount: 1,
          startDate: 1,
          endDate: 2,
          candles: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }],
        }),
        previewFixture({
          fileName: 'b_1h.csv',
          fileSize: 1,
          symbol: 'XAU',
          timeframe: '1h',
          rowCount: 1,
          startDate: 1,
          endDate: 2,
          candles: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }],
        }),
      ]),
    ).toThrow(/Duplicate timeframe/)
  })
})
