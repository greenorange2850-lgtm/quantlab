import type { Fill } from './fill.js'

/**
 * Outcome of submitting an order to the execution engine.
 */
export interface ExecutionResult {
  orderId: string
  accepted: boolean
  rejected: boolean
  fills: Fill[]
  reason?: string
  remainingQuantity: number
}

export function createRejectedResult(
  orderId: string,
  reason: string,
  requestedQuantity: number,
): ExecutionResult {
  return {
    orderId,
    accepted: false,
    rejected: true,
    fills: [],
    reason,
    remainingQuantity: requestedQuantity,
  }
}

export function createFilledResult(
  orderId: string,
  fills: Fill[],
  remainingQuantity = 0,
): ExecutionResult {
  return {
    orderId,
    accepted: true,
    rejected: false,
    fills,
    remainingQuantity,
  }
}
