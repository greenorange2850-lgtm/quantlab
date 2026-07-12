import { describe, expect, it, beforeEach } from 'vitest'
import { OrderSide, OrderType } from '../../models/order.js'
import { ExecutionEngine, executeOrder } from '../execution-engine.js'
import { OrderManager } from '../order-manager.js'
import type { ExecutionContext } from '../execution-context.js'
import type { OrderRequest } from '../order-request.js'

const baseContext: ExecutionContext = {
  symbol: 'BTCUSDT',
  marketPrice: 100,
  timestamp: 1_000,
  commissionPercent: 0.1,
  slippagePercent: 0,
}

function buildRequest(overrides: Partial<OrderRequest> = {}): OrderRequest {
  return {
    symbol: 'BTCUSDT',
    side: OrderSide.BUY,
    quantity: 1,
    orderType: OrderType.MARKET,
    ...overrides,
  }
}

describe('executeOrder', () => {
  beforeEach(() => {
    const engine = new ExecutionEngine()
    engine.executeOrder(buildRequest({ id: 'reset-1' }), baseContext)
  })

  it('fills a market order at the market price', () => {
    const result = executeOrder(buildRequest(), baseContext)

    expect(result.accepted).toBe(true)
    expect(result.rejected).toBe(false)
    expect(result.fills).toHaveLength(1)
    expect(result.fills[0]?.fillPrice).toBe(100)
    expect(result.fills[0]?.fillQuantity).toBe(1)
    expect(result.remainingQuantity).toBe(0)
  })

  it('fills a limit order when price condition is met', () => {
    const result = executeOrder(
      buildRequest({
        side: OrderSide.BUY,
        orderType: OrderType.LIMIT,
        limitPrice: 105,
      }),
      baseContext,
    )

    expect(result.accepted).toBe(true)
    expect(result.fills[0]?.fillPrice).toBe(105)
  })

  it('rejects a limit order when price condition is not met', () => {
    const result = executeOrder(
      buildRequest({
        side: OrderSide.BUY,
        orderType: OrderType.LIMIT,
        limitPrice: 95,
      }),
      baseContext,
    )

    expect(result.accepted).toBe(false)
    expect(result.rejected).toBe(true)
    expect(result.reason).toBe('limit price not met')
    expect(result.fills).toHaveLength(0)
  })

  it('rejects orders for the wrong symbol', () => {
    const result = executeOrder(
      buildRequest({ symbol: 'ETHUSDT' }),
      baseContext,
    )

    expect(result.rejected).toBe(true)
    expect(result.reason).toBe('symbol does not match execution context')
  })

  it('applies commission to fills', () => {
    const result = executeOrder(buildRequest({ quantity: 2 }), baseContext)

    expect(result.fills[0]?.commission).toBeCloseTo(0.2, 5)
  })

  it('applies slippage to market fills', () => {
    const result = executeOrder(
      buildRequest({ side: OrderSide.BUY }),
      { ...baseContext, slippagePercent: 1 },
    )

    expect(result.fills[0]?.fillPrice).toBeCloseTo(101, 5)
    expect(result.fills[0]?.slippage).toBeCloseTo(1, 5)
  })

  it('supports partial fills as a placeholder', () => {
    const result = executeOrder(
      buildRequest({ quantity: 2 }),
      { ...baseContext, allowPartialFills: true },
    )

    expect(result.accepted).toBe(true)
    expect(result.fills[0]?.fillQuantity).toBe(1)
    expect(result.remainingQuantity).toBe(1)
  })
})

describe('OrderManager', () => {
  it('tracks filled and rejected orders separately', () => {
    const manager = new OrderManager()
    const engine = new ExecutionEngine()

    const filled = engine.executeOrder(buildRequest({ id: 'filled-1' }), baseContext)
    const rejected = engine.executeOrder(
      buildRequest({ id: 'rejected-1', orderType: OrderType.LIMIT, limitPrice: 90 }),
      baseContext,
    )

    manager.recordExecution(buildRequest({ id: 'filled-1' }), filled, baseContext.timestamp)
    manager.recordExecution(
      buildRequest({ id: 'rejected-1', orderType: OrderType.LIMIT, limitPrice: 90 }),
      rejected,
      baseContext.timestamp,
    )

    expect(manager.getFilled()).toHaveLength(1)
    expect(manager.getRejected()).toHaveLength(1)
    expect(manager.getPending()).toHaveLength(0)
  })

  it('tracks partially filled orders as pending', () => {
    const manager = new OrderManager()
    const engine = new ExecutionEngine()
    const request = buildRequest({ id: 'partial-1', quantity: 4 })
    const result = engine.executeOrder(request, { ...baseContext, allowPartialFills: true })

    manager.recordExecution(request, result, baseContext.timestamp)

    expect(manager.getPending()).toHaveLength(1)
    expect(manager.getPending()[0]?.status).toBe('PARTIALLY_FILLED')
  })

  it('tracks cancelled orders', () => {
    const manager = new OrderManager()
    const engine = new ExecutionEngine()
    const request = buildRequest({ id: 'pending-1', quantity: 4 })
    const result = engine.executeOrder(request, { ...baseContext, allowPartialFills: true })

    manager.recordExecution(request, result, baseContext.timestamp)
    const cancelled = manager.cancelOrder('pending-1', 2_000)

    expect(cancelled?.status).toBe('CANCELLED')
    expect(manager.getCancelled()).toHaveLength(1)
    expect(manager.getPending()).toHaveLength(0)
  })
})
