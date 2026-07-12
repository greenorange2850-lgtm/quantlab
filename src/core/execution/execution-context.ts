/**
 * Market and policy context used to simulate or route order execution.
 */
export interface ExecutionContext {
  symbol: string
  marketPrice: number
  timestamp: number
  commissionPercent: number
  slippagePercent: number
  allowPartialFills?: boolean
}

export function validateExecutionContext(context: ExecutionContext): void {
  if (!context.symbol.trim()) {
    throw new Error('symbol must be a non-empty string')
  }

  if (!Number.isFinite(context.marketPrice) || context.marketPrice <= 0) {
    throw new Error('marketPrice must be a positive finite number')
  }

  if (!Number.isFinite(context.timestamp)) {
    throw new Error('timestamp must be a finite number')
  }

  if (!Number.isFinite(context.commissionPercent) || context.commissionPercent < 0) {
    throw new Error('commissionPercent cannot be negative')
  }

  if (!Number.isFinite(context.slippagePercent) || context.slippagePercent < 0) {
    throw new Error('slippagePercent cannot be negative')
  }
}
