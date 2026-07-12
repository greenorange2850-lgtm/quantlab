import type { PositionSizeInput, PositionSizeResult } from './types.js'

function assertFinite(field: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`)
  }
}

function resolveMultiplier(value: number | undefined, field: string): number {
  if (value === undefined) {
    return 1
  }

  assertFinite(field, value)

  if (value <= 0) {
    throw new Error(`${field} must be greater than 0`)
  }

  return value
}

function validateInput(input: PositionSizeInput): {
  stopDistance: number
  contractMultiplier: number
  tickValue: number
} {
  const { accountEquity, riskPercent, entryPrice, stopLossPrice } = input

  assertFinite('accountEquity', accountEquity)
  assertFinite('riskPercent', riskPercent)
  assertFinite('entryPrice', entryPrice)
  assertFinite('stopLossPrice', stopLossPrice)

  if (accountEquity <= 0) {
    throw new Error('accountEquity must be greater than 0')
  }

  if (entryPrice <= 0 || stopLossPrice <= 0) {
    throw new Error('entryPrice and stopLossPrice must be greater than 0')
  }

  if (entryPrice === stopLossPrice) {
    throw new Error('stopLossPrice must not equal entryPrice')
  }

  if (riskPercent < 0) {
    throw new Error('riskPercent cannot be negative')
  }

  const contractMultiplier = resolveMultiplier(input.contractMultiplier, 'contractMultiplier')
  const tickValue = resolveMultiplier(input.tickValue, 'tickValue')
  const stopDistance = Math.abs(entryPrice - stopLossPrice)

  return { stopDistance, contractMultiplier, tickValue }
}

/**
 * Calculates position size using fixed-fractional risk management.
 *
 * Formula:
 * - riskAmount = accountEquity × (riskPercent / 100)
 * - stopDistance = |entryPrice − stopLossPrice|
 * - riskPerUnit = stopDistance × contractMultiplier × tickValue
 * - quantity = riskAmount / riskPerUnit
 *
 * Values are returned at full floating-point precision. No rounding is applied
 * so downstream broker adapters can enforce exchange lot size, tick size, and
 * margin rules without compounding rounding error in the core library.
 */
export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const { stopDistance, contractMultiplier, tickValue } = validateInput(input)
  const riskAmount = (input.accountEquity * input.riskPercent) / 100
  const riskPerUnit = stopDistance * contractMultiplier * tickValue
  const quantity = riskAmount / riskPerUnit
  const positionValue = quantity * input.entryPrice
  const effectiveRiskPercent = (riskAmount / input.accountEquity) * 100

  return {
    quantity,
    riskAmount,
    stopDistance,
    positionValue,
    effectiveRiskPercent,
  }
}
