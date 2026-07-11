const DEFAULT_PERIOD = 14

export function calculateRSI(values: number[], period: number = DEFAULT_PERIOD): number[] {
  if (period <= 0) {
    throw new Error('period must be greater than 0')
  }
  if (period > values.length) {
    throw new Error('period cannot exceed values length')
  }

  const result = new Array<number>(values.length).fill(NaN)
  if (values.length === 0 || values.length <= period) {
    return result
  }

  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1]
    if (change > 0) {
      avgGain += change
    } else {
      avgLoss -= change
    }
  }

  avgGain /= period
  avgLoss /= period
  result[period] = computeRSI(avgGain, avgLoss)

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result[i] = computeRSI(avgGain, avgLoss)
  }

  return result
}

function computeRSI(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100
  }
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}
