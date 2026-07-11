import type { Request, Response } from 'express'
import type { ApiResponse } from '@trading-os/shared'

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = { success: true, data }
  res.status(status).json(body)
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201)
}

export function parsePagination(req: Request) {
  return {
    page: Math.max(1, Number(req.query.page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(req.query.pageSize) || 20)),
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') ?? 'desc',
    search: req.query.search as string | undefined,
  }
}
