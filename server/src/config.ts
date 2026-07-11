export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  dbPath: process.env.DB_PATH,
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
} as const
