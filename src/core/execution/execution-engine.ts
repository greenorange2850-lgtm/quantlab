import { OrderSide, OrderType } from '../models/order.js'
import { calculateCommission } from './commission.js'
import type { ExecutionContext } from './execution-context.js'
import { validateExecutionContext } from './execution-context.js'
import {
  createFilledResult,
  createRejectedResult,
  type ExecutionResult,
} from './execution-result.js'
import type { Fill } from './fill.js'
import type { OrderRequest } from './order-request.js'
import { validateOrderRequest } from './order-request.js'

let orderCounter = 0

function createOrderId(request: OrderRequest): string {
  return request.id ?? `order-${++orderCounter}`
}

function roundPrice(value: number): number {
  return Math.round(value * 1e8) / 1e8
}

/**
 * Estimates the execution price after slippage for order sizing.
 */
export function estimateFillPrice(
  marketPrice: number,
  side: OrderSide,
  slippagePercent: number,
): number {
  if (slippagePercent === 0) {
    return marketPrice
  }

  const slippageMultiplier =
    side === OrderSide.BUY
      ? 1 + slippagePercent / 100
      : 1 - slippagePercent / 100

  return roundPrice(marketPrice * slippageMultiplier)
}

function applySlippage(marketPrice: number, side: OrderSide, slippagePercent: number): {
  fillPrice: number
  slippage: number
} {
  const fillPrice = estimateFillPrice(marketPrice, side, slippagePercent)
  const slippage = slippagePercent === 0 ? 0 : roundPrice(Math.abs(fillPrice - marketPrice))

  return { fillPrice, slippage }
}

function canFillLimitOrder(
  request: OrderRequest,
  marketPrice: number,
): boolean {
  const limitPrice = request.limitPrice!

  if (request.side === OrderSide.BUY) {
    return marketPrice <= limitPrice
  }

  return marketPrice >= limitPrice
}

function resolveFillQuantity(request: OrderRequest, context: ExecutionContext): {
  fillQuantity: number
  remainingQuantity: number
} {
  if (!context.allowPartialFills) {
    return {
      fillQuantity: request.quantity,
      remainingQuantity: 0,
    }
  }

  const fillQuantity = roundPrice(request.quantity / 2)
  return {
    fillQuantity,
    remainingQuantity: roundPrice(request.quantity - fillQuantity),
  }
}

function buildFill(
  orderId: string,
  request: OrderRequest,
  context: ExecutionContext,
  fillQuantity: number,
  fillPrice: number,
  slippage: number,
): Fill {
  const notional = fillPrice * fillQuantity

  return {
    orderId,
    symbol: request.symbol,
    side: request.side,
    fillPrice,
    fillQuantity,
    commission: calculateCommission(notional, context.commissionPercent),
    slippage,
    timestamp: context.timestamp,
  }
}

/**
 * Simulates order validation, slippage, commission, and fill generation.
 */
export function executeOrder(
  request: OrderRequest,
  context: ExecutionContext,
): ExecutionResult {
  validateOrderRequest(request)
  validateExecutionContext(context)

  const orderId = createOrderId(request)

  if (request.symbol !== context.symbol) {
    return createRejectedResult(orderId, 'symbol does not match execution context', request.quantity)
  }

  if (request.orderType === OrderType.LIMIT && !canFillLimitOrder(request, context.marketPrice)) {
    return createRejectedResult(orderId, 'limit price not met', request.quantity)
  }

  if (request.orderType === OrderType.STOP || request.orderType === OrderType.STOP_LIMIT) {
    return createRejectedResult(orderId, 'stop orders are not supported yet', request.quantity)
  }

  const { fillQuantity, remainingQuantity } = resolveFillQuantity(request, context)

  if (fillQuantity <= 0) {
    return createRejectedResult(orderId, 'fill quantity must be positive', request.quantity)
  }

  const referencePrice =
    request.orderType === OrderType.LIMIT ? request.limitPrice! : context.marketPrice
  const { fillPrice, slippage } = applySlippage(referencePrice, request.side, context.slippagePercent)
  const fill = buildFill(orderId, request, context, fillQuantity, fillPrice, slippage)

  return createFilledResult(orderId, [fill], remainingQuantity)
}

/**
 * Stateful wrapper around {@link executeOrder} for venue adapters.
 */
export class ExecutionEngine {
  executeOrder(request: OrderRequest, context: ExecutionContext): ExecutionResult {
    return executeOrder(request, context)
  }
}
