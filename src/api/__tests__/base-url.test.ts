import { describe, expect, it, vi, afterEach } from 'vitest'

describe('getApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses VITE_API_BASE_URL when set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api/v1/')
    const { getApiBaseUrl } = await import('../base-url.js')
    expect(getApiBaseUrl()).toBe('https://api.example.com/api/v1')
  })

  it('falls back to legacy VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('VITE_API_URL', 'https://legacy.example.com/api/v1')
    const { getApiBaseUrl } = await import('../base-url.js')
    expect(getApiBaseUrl()).toBe('https://legacy.example.com/api/v1')
  })

  it('defaults to local development API when unset', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('VITE_API_URL', '')
    const { getApiBaseUrl } = await import('../base-url.js')
    expect(getApiBaseUrl()).toBe('http://localhost:3001/api/v1')
  })
})
