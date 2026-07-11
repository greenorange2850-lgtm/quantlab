import type { RawCandle, ImportError } from '../types/index.js'

export interface ValidationResult {
  valid: RawCandle[]
  rejected: ImportError[]
  stats: {
    invalidOhlc: number
    negativePrices: number
    invalidTimestamp: number
  }
}

export function validateCandle(candle: RawCandle, rowIndex: number): ImportError | null {
  if (isNaN(new Date(candle.timestamp).getTime())) {
    return { row: rowIndex, message: 'Invalid timestamp', raw: candle.timestamp }
  }

  const { open, high, low, close, volume } = candle

  if ([open, high, low, close].some((v) => isNaN(v))) {
    return { row: rowIndex, message: 'Non-numeric OHLC value' }
  }

  if (open < 0 || high < 0 || low < 0 || close < 0) {
    return { row: rowIndex, message: 'Negative price detected' }
  }

  if (high < low) {
    return { row: rowIndex, message: 'High < Low (invalid OHLC)' }
  }

  if (high < Math.max(open, close) || low > Math.min(open, close)) {
    return { row: rowIndex, message: 'OHLC relationship invalid' }
  }

  if (volume < 0) {
    return { row: rowIndex, message: 'Negative volume' }
  }

  return null
}

export function validateCandles(candles: RawCandle[]): ValidationResult {
  const valid: RawCandle[] = []
  const rejected: ImportError[] = []
  const stats = { invalidOhlc: 0, negativePrices: 0, invalidTimestamp: 0 }

  candles.forEach((candle, i) => {
    const error = validateCandle(candle, i + 1)
    if (error) {
      rejected.push(error)
      if (error.message.includes('OHLC')) stats.invalidOhlc++
      else if (error.message.includes('Negative')) stats.negativePrices++
      else if (error.message.includes('timestamp')) stats.invalidTimestamp++
    } else {
      valid.push(candle)
    }
  })

  return { valid, rejected, stats }
}
