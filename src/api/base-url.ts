import { API_BASE_PATH } from '@trading-os/shared'

/**
 * Public API origin used by the browser.
 * Prefer VITE_API_BASE_URL (includes path, e.g. https://api.example.com/api/v1).
 * Falls back to legacy VITE_API_URL, then local development default.
 */
export function getApiBaseUrl(): string {
  for (const key of ['VITE_API_BASE_URL', 'VITE_API_URL'] as const) {
    const value = import.meta.env[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().replace(/\/$/, '')
    }
  }
  return `http://localhost:3001${API_BASE_PATH}`
}
