export function calculateSMA(values: number[], period: number): number[] {
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

  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) {
      sum -= values[i - period]
    }
    if (i >= period - 1) {
      result[i] = sum / period
    }
  }

  return result
}
