import type { Database } from 'better-sqlite3'

export abstract class BaseRepository {
  constructor(protected readonly db: Database) {}

  protected parseJson<T>(value: string | null, fallback: T): T {
    if (!value) return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  protected stringifyJson(value: unknown): string {
    return JSON.stringify(value)
  }
}
