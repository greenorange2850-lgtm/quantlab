import type { CorsOptions } from 'cors'
import { config, isProduction } from './config.js'

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i

function parseOrigins(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * CORS policy:
 * - development: allow localhost / 127.0.0.1 (any port) plus optional CORS_ORIGIN list
 * - production: only origins listed in CORS_ORIGIN (required)
 */
export function createCorsOptions(): CorsOptions {
  const configured = parseOrigins(config.corsOrigin)

  if (isProduction()) {
    if (configured.length === 0) {
      throw new Error('CORS_ORIGIN is required when NODE_ENV=production')
    }
    const allowed = new Set(configured)
    return {
      origin(origin, callback) {
        if (!origin || allowed.has(origin)) {
          callback(null, true)
          return
        }
        callback(new Error(`Origin not allowed by CORS: ${origin}`))
      },
    }
  }

  const allowed = new Set(configured)
  // Default Vite dev origin when nothing is configured
  if (allowed.size === 0) {
    allowed.add('http://localhost:5173')
  }

  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin) || LOCALHOST_ORIGIN.test(origin)) {
        callback(null, true)
        return
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`))
    },
  }
}

/** Test helper: whether an origin would be allowed under the current env. */
export function isOriginAllowed(origin: string | undefined): boolean {
  const options = createCorsOptions()
  const check = options.origin
  if (typeof check !== 'function') {
    return check === true || check === origin || (Array.isArray(check) && !!origin && check.includes(origin))
  }

  let allowed = false
  check(origin ?? undefined, (err, value) => {
    allowed = !err && value !== false
  })
  return allowed
}
