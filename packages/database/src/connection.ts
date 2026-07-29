import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'trading-os.db')

let instance: Database.Database | null = null
let activePath: string | null = null

export interface DatabaseConfig {
  path?: string
  readonly?: boolean
}

/**
 * Resolve SQLite file path.
 * Order: explicit config.path → DATABASE_PATH → legacy DB_PATH → local default.
 */
export function resolveDatabasePath(explicitPath?: string): string {
  if (explicitPath && explicitPath.trim()) {
    return path.resolve(explicitPath.trim())
  }

  const fromEnv = process.env.DATABASE_PATH?.trim() || process.env.DB_PATH?.trim()
  if (fromEnv) {
    return path.resolve(fromEnv)
  }

  return DEFAULT_DB_PATH
}

export function getDatabase(config: DatabaseConfig = {}): Database.Database {
  if (instance) return instance

  const dbPath = resolveDatabasePath(config.path)
  const dir = path.dirname(dbPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  instance = new Database(dbPath, {
    readonly: config.readonly ?? false,
    fileMustExist: false,
  })
  activePath = dbPath

  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')

  return instance
}

export function closeDatabase(): void {
  if (instance) {
    instance.close()
    instance = null
    activePath = null
  }
}

export function getDatabasePath(): string {
  return activePath ?? resolveDatabasePath()
}
