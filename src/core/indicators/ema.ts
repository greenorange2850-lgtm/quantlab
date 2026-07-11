export function calculateEMA(values: number[], period: number): number[] {
  if (period <= 0) {
    throw new Error('period must be greater than 0')
  }
  if (period > values.length) {
    throw new Error('period cannot exceed values length')
  }

  const result = new Array<number>(values.length).fill(NaN)
  if (values.length === 0) {
    return result
  }

  const multiplier = 2 / (period + 1)

  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += values[i]
  }
  let ema = sum / period
  result[period - 1] = ema

  for (let i = period; i < values.length; i++) {
    ema = values[i] * multiplier + ema * (1 - multiplier)
    result[i] = ema
  }

  return result
}
