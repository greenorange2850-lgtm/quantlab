import { afterEach, describe, expect, it, vi } from 'vitest'

describe('createCorsOptions / isOriginAllowed', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('allows localhost origins in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CORS_ORIGIN', '')
    const { isOriginAllowed } = await import('./cors.js')
    expect(isOriginAllowed('http://localhost:5173')).toBe(true)
    expect(isOriginAllowed('http://127.0.0.1:4173')).toBe(true)
    expect(isOriginAllowed(undefined)).toBe(true)
  })

  it('requires CORS_ORIGIN in production and allows only configured origins', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CORS_ORIGIN', 'https://app.example.com,https://www.example.com')
    const { isOriginAllowed } = await import('./cors.js')
    expect(isOriginAllowed('https://app.example.com')).toBe(true)
    expect(isOriginAllowed('https://www.example.com')).toBe(true)
    expect(isOriginAllowed('http://localhost:5173')).toBe(false)
    expect(isOriginAllowed('https://evil.example.com')).toBe(false)
  })

  it('throws when production CORS_ORIGIN is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CORS_ORIGIN', '')
    const { createCorsOptions } = await import('./cors.js')
    expect(() => createCorsOptions()).toThrow(/CORS_ORIGIN/)
  })
})
