import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'trading-os.db')

let instance: Database.Database | null = null

export interface DatabaseConfig {
  path?: string
  readonly?: boolean
}

export function getDatabase(config: DatabaseConfig = {}): Database.Database {
  if (instance) return instance

  const dbPath = config.path ?? DEFAULT_DB_PATH
  const dir = path.dirname(dbPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  instance = new Database(dbPath, {
    readonly: config.readonly ?? false,
    fileMustExist: false,
  })

  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')

  return instance
}

export function closeDatabase(): void {
  if (instance) {
    instance.close()
    instance = null
  }
}

export function getDatabasePath(): string {
  return DEFAULT_DB_PATH
}
