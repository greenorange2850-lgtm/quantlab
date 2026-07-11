import type { Request, Response, NextFunction } from 'express'
import type { ApiError } from '@trading-os/shared'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiError>,
  _next: NextFunction,
): void {
  console.error(`[API Error] ${err.message}`)
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
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
