import { API_BASE_PATH } from '@trading-os/shared'
import type { ApiError, ApiResponse } from '@trading-os/shared'

const BASE_URL = import.meta.env.VITE_API_URL ?? `http://localhost:3001${API_BASE_PATH}`

export class ApiClientError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  const body = await response.json()

  if (!response.ok || body.success === false) {
    const err = body as ApiError
    throw new ApiClientError(
      err.error?.code ?? 'UNKNOWN',
      err.error?.message ?? 'Request failed',
      response.status,
    )
  }

  return (body as ApiResponse<T>).data
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
}
