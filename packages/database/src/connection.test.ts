import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('resolveDatabasePath', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to cwd/data/trading-os.db', async () => {
    vi.stubEnv('DATABASE_PATH', '')
    vi.stubEnv('DB_PATH', '')
    const { resolveDatabasePath } = await import('./connection.js')
    expect(resolveDatabasePath()).toBe(path.resolve(process.cwd(), 'data', 'trading-os.db'))
  })

  it('prefers DATABASE_PATH over DB_PATH', async () => {
    vi.stubEnv('DATABASE_PATH', '/data/prod.db')
    vi.stubEnv('DB_PATH', '/tmp/legacy.db')
    const { resolveDatabasePath } = await import('./connection.js')
    expect(resolveDatabasePath()).toBe(path.resolve('/data/prod.db'))
  })

  it('creates parent directory when opening the database', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quantlab-db-'))
    const dbFile = path.join(dir, 'nested', 'test.db')
    vi.stubEnv('DATABASE_PATH', dbFile)

    const { getDatabase, closeDatabase, getDatabasePath } = await import('./connection.js')
    try {
      getDatabase()
      expect(fs.existsSync(path.dirname(dbFile))).toBe(true)
      expect(getDatabasePath()).toBe(path.resolve(dbFile))
    } finally {
      closeDatabase()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
