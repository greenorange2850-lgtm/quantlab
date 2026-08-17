import type { TradeDirection } from './Trade.js'

export { calculateCommission } from '../execution/commission.js'

export function calculateLongPnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  entryCommission: number,
  exitCommission: number,
): number {
  return (exitPrice - entryPrice) * quantity - entryCommission - exitCommission
}

export function calculateShortPnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  entryCommission: number,
  exitCommission: number,
): number {
  return (entryPrice - exitPrice) * quantity - entryCommission - exitCommission
}

export function calculateTradeDuration(entryTime: number, exitTime: number): number {
  return exitTime - entryTime
}

export function calculatePositionQuantity(
  equity: number,
  price: number,
  positionSizePercent: number,
): number {
  if (price <= 0) {
    throw new Error('price must be greater than 0')
  }
  const notional = (equity * positionSizePercent) / 100
  return notional / price
}

export function calculatePnL(
  direction: TradeDirection,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  entryCommission: number,
  exitCommission: number,
): number {
  return direction === 'LONG'
    ? calculateLongPnL(entryPrice, exitPrice, quantity, entryCommission, exitCommission)
    : calculateShortPnL(entryPrice, exitPrice, quantity, entryCommission, exitCommission)
}
