import { OrderStatus } from '../models/order.js'
import type { ExecutionResult } from './execution-result.js'
import type { Fill } from './fill.js'
import type { OrderRequest } from './order-request.js'

export interface ManagedOrder {
  id: string
  request: OrderRequest
  status: OrderStatus
  fills: Fill[]
  createdAt: number
  updatedAt: number
  reason?: string
  remainingQuantity: number
}

/**
 * Tracks order lifecycle buckets for backtest, paper, and live modes.
 */
export class OrderManager {
  private readonly pending = new Map<string, ManagedOrder>()
  private readonly filled = new Map<string, ManagedOrder>()
  private readonly cancelled = new Map<string, ManagedOrder>()
  private readonly rejected = new Map<string, ManagedOrder>()

  recordExecution(
    request: OrderRequest,
    result: ExecutionResult,
    timestamp: number,
  ): ManagedOrder {
    const managedOrder: ManagedOrder = {
      id: result.orderId,
      request,
      status: resolveStatus(result),
      fills: [...result.fills],
      createdAt: timestamp,
      updatedAt: timestamp,
      reason: result.reason,
      remainingQuantity: result.remainingQuantity,
    }

    this.removeFromAll(result.orderId)

    if (result.rejected) {
      this.rejected.set(result.orderId, managedOrder)
      return managedOrder
    }

    if (result.remainingQuantity > 0) {
      this.pending.set(result.orderId, managedOrder)
      return managedOrder
    }

    this.filled.set(result.orderId, managedOrder)
    return managedOrder
  }

  cancelOrder(orderId: string, timestamp: number): ManagedOrder | null {
    const pendingOrder = this.pending.get(orderId)
    if (!pendingOrder) {
      return null
    }

    const cancelledOrder: ManagedOrder = {
      ...pendingOrder,
      status: OrderStatus.CANCELLED,
      updatedAt: timestamp,
    }

    this.pending.delete(orderId)
    this.cancelled.set(orderId, cancelledOrder)
    return cancelledOrder
  }

  getPending(): ManagedOrder[] {
    return [...this.pending.values()]
  }

  getFilled(): ManagedOrder[] {
    return [...this.filled.values()]
  }

  getCancelled(): ManagedOrder[] {
    return [...this.cancelled.values()]
  }

  getRejected(): ManagedOrder[] {
    return [...this.rejected.values()]
  }

  private removeFromAll(orderId: string): void {
    this.pending.delete(orderId)
    this.filled.delete(orderId)
    this.cancelled.delete(orderId)
    this.rejected.delete(orderId)
  }
}

function resolveStatus(result: ExecutionResult): OrderStatus {
  if (result.rejected) {
    return OrderStatus.REJECTED
  }

  if (result.remainingQuantity > 0) {
    return OrderStatus.PARTIALLY_FILLED
  }

  return OrderStatus.FILLED
}
