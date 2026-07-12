export interface BacktestConfig {
  initialCapital: number
  commissionPercent: number
  positionSizePercent: number
  slippagePercent?: number
  symbol: string
}

export function validateBacktestConfig(config: BacktestConfig): void {
  if (config.initialCapital <= 0) {
    throw new Error('initialCapital must be greater than 0')
  }
  if (config.commissionPercent < 0) {
    throw new Error('commissionPercent cannot be negative')
  }
  if (config.positionSizePercent <= 0 || config.positionSizePercent > 100) {
    throw new Error('positionSizePercent must be between 0 and 100')
  }
  if (!config.symbol.trim()) {
    throw new Error('symbol must be a non-empty string')
  }
}
