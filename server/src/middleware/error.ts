import type { Request, Response, NextFunction } from 'express'
import type { ApiError } from '@trading-os/shared'

export function errorHandler(
  err: Error & { status?: number; code?: string },
  _req: Request,
  res: Response<ApiError>,
  _next: NextFunction,
): void {
  console.error(`[API Error] ${err.message}`)
  const status = err.status ?? 500
  res.status(status).json({
    success: false,
    error: {
      code: err.code ?? (status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'),
      message: err.message,
    },
  })
}

export function notFoundHandler(_req: Request, res: Response<ApiError>): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  })
}
