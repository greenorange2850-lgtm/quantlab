function readPort(): number {
  const raw = process.env.PORT
  if (raw === undefined || raw.trim() === '') return 3001
  const port = Number(raw)
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${raw}`)
  }
  return port
}

export const config = {
  port: readPort(),
  /** Bind address. Defaults to 0.0.0.0 so containers accept external traffic. */
  host: process.env.HOST?.trim() || '0.0.0.0',
  /** Prefer DATABASE_PATH; DB_PATH kept as a legacy alias. */
  databasePath: process.env.DATABASE_PATH?.trim() || process.env.DB_PATH?.trim() || undefined,
  corsOrigin: process.env.CORS_ORIGIN?.trim() || undefined,
  nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
} as const

export function isProduction(): boolean {
  return config.nodeEnv === 'production'
}
