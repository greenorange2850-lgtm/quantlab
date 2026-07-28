function resolveCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGIN
  if (!raw || raw === '*') return true
  if (raw.includes(',')) return raw.split(',').map((value) => value.trim())
  return raw
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  corsOrigin: resolveCorsOrigin(),
  serveStatic: process.env.SERVE_STATIC !== '0',
  staticDir: process.env.STATIC_DIR,
  dbPath: process.env.DB_PATH,
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
} as const
