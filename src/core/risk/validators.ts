import type { RiskConfig } from './config.js'

function assertFinite(field: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`)
  }
}

/**
 * Validates a {@link RiskConfig} object.
 * Throws descriptive errors when limits are out of range.
 */
export function validateRiskConfig(config: RiskConfig): void {
  assertFinite('riskPercent', config.riskPercent)
  assertFinite('maxPositionSize', config.maxPositionSize)
  assertFinite('maxOpenPositions', config.maxOpenPositions)
  assertFinite('maxDailyLossPercent', config.maxDailyLossPercent)
  assertFinite('maxDrawdownPercent', config.maxDrawdownPercent)

  if (config.riskPercent <= 0) {
    throw new Error('riskPercent must be greater than 0')
  }

  if (config.riskPercent > 100) {
    throw new Error('riskPercent must be less than or equal to 100')
  }

  if (config.maxPositionSize <= 0) {
    throw new Error('maxPositionSize must be greater than 0')
  }

  if (config.maxOpenPositions < 1) {
    throw new Error('maxOpenPositions must be greater than or equal to 1')
  }

  if (config.maxDailyLossPercent < 0) {
    throw new Error('maxDailyLossPercent cannot be negative')
  }

  if (config.maxDrawdownPercent < 0) {
    throw new Error('maxDrawdownPercent cannot be negative')
  }
}
