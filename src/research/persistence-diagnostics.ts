/**
 * Helpers for diagnosing Vercel-origin localStorage isolation.
 * localStorage is partitioned by origin (scheme + host + port).
 */

/** Unique per-deploy Vercel hosts: `{project}-{deploymentId}-{scope}.vercel.app`. */
export function isEphemeralVercelDeploymentHost(hostname: string): boolean {
  // deploymentId is alphanumeric (no hyphens), typically 8–12 chars.
  return /^[a-z0-9-]+-[a-z0-9]{8,12}-[a-z0-9-]+\.vercel\.app$/i.test(hostname)
}

/** Stable production alias for this project (shared localStorage across deploys). */
export const STABLE_VERCEL_PRODUCTION_URL = 'https://quantlab-frontend.vercel.app'

export function classifyVercelHost(hostname: string): {
  kind: 'ephemeral-deployment' | 'stable-or-other' | 'non-vercel'
  warning: string | null
} {
  if (!/\.vercel\.app$/i.test(hostname)) {
    return { kind: 'non-vercel', warning: null }
  }
  if (isEphemeralVercelDeploymentHost(hostname)) {
    return {
      kind: 'ephemeral-deployment',
      warning:
        `This host is a per-deployment URL. localStorage here is isolated from ${STABLE_VERCEL_PRODUCTION_URL} and from other preview/production deployment URLs.`,
    }
  }
  return { kind: 'stable-or-other', warning: null }
}

/** Show diagnostics in local dev, on Vercel hosts, or with ?persistDiag=1. */
export function shouldShowPersistenceDiagnostics(input: {
  isDev: boolean
  hostname: string
  search: string
}): boolean {
  if (input.isDev) return true
  if (/\.vercel\.app$/i.test(input.hostname)) return true
  try {
    const params = new URLSearchParams(input.search)
    return params.get('persistDiag') === '1'
  } catch {
    return false
  }
}
