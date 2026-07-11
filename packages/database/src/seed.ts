import { getDatabase } from './connection.js'
import { migrate } from './migrate.js'
import { pathToFileURL } from 'url'

export function seed(): void {
  migrate()
  const db = getDatabase()

  const existing = db.prepare('SELECT COUNT(*) as count FROM symbols').get() as { count: number }
  if (existing.count > 0) {
    console.log('Database already seeded. Skipping.')
    return
  }

  const insertSymbol = db.prepare(`
    INSERT INTO symbols (id, name, display_name, asset_class, pip_size, tick_size)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const symbols = [
    ['sym-xauusd', 'XAUUSD', 'Gold / US Dollar', 'commodities', 0.01, 0.01],
    ['sym-eurusd', 'EURUSD', 'Euro / US Dollar', 'forex', 0.0001, 0.00001],
    ['sym-gbpusd', 'GBPUSD', 'British Pound / US Dollar', 'forex', 0.0001, 0.00001],
    ['sym-usdjpy', 'USDJPY', 'US Dollar / Japanese Yen', 'forex', 0.01, 0.001],
    ['sym-btcusd', 'BTCUSD', 'Bitcoin / US Dollar', 'crypto', 1, 0.01],
    ['sym-ethusd', 'ETHUSD', 'Ethereum / US Dollar', 'crypto', 0.01, 0.01],
  ] as const

  for (const s of symbols) insertSymbol.run(...s)

  const insertTf = db.prepare(`
    INSERT INTO timeframes (id, code, minutes, label) VALUES (?, ?, ?, ?)
  `)

  const timeframes = [
    ['tf-m15', 'M15', 15, '15 Minutes'],
    ['tf-h1', 'H1', 60, '1 Hour'],
    ['tf-h4', 'H4', 240, '4 Hours'],
    ['tf-d1', 'D1', 1440, 'Daily'],
  ] as const

  for (const tf of timeframes) insertTf.run(...tf)

  const insertSession = db.prepare(`
    INSERT INTO sessions (id, name, type, start_utc, end_utc, timezone) VALUES (?, ?, ?, ?, ?, ?)
  `)

  const sessions = [
    ['sess-asian', 'Asian', 'asian', '00:00', '08:00', 'UTC'],
    ['sess-london', 'London', 'london', '08:00', '16:00', 'UTC'],
    ['sess-ny', 'New York', 'new_york', '13:00', '21:00', 'UTC'],
    ['sess-overlap', 'London/NY Overlap', 'overlap', '13:00', '16:00', 'UTC'],
  ] as const

  for (const s of sessions) insertSession.run(...s)

  const insertStrategy = db.prepare(`
    INSERT INTO strategies (id, name, description, status, tags)
    VALUES (?, ?, ?, ?, ?)
  `)

  insertStrategy.run(
    'str-momentum-breakout',
    'Momentum Breakout',
    'ICT-inspired momentum breakout strategy with session filtering and HTF bias',
    'active',
    JSON.stringify(['momentum', 'breakout', 'ict']),
  )

  const insertVersion = db.prepare(`
    INSERT INTO strategy_versions (id, strategy_id, version, version_number, rules, filters, metrics, changelog)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const rules = JSON.stringify({
    entryConditions: [
      { id: 'ec-1', type: 'bos', operator: 'and', parameters: { direction: 'bullish' }, description: 'Break of structure bullish' },
      { id: 'ec-2', type: 'fvg', operator: 'and', parameters: { minSize: 5 }, description: 'FVG confirmation' },
    ],
    exitConditions: [
      { id: 'xc-1', type: 'rr_target', operator: 'and', parameters: { ratio: 2 }, description: '2R take profit' },
    ],
    riskManagement: { maxRiskPerTrade: 1, maxDailyLoss: 3, maxDrawdown: 15, trailingStop: false, breakEvenAt: 1 },
    positionSizing: { method: 'percent', value: 1 },
  })

  const filters = JSON.stringify({
    sessions: ['london', 'overlap'],
    timeframes: ['H1'],
    htfBias: true,
    htfTimeframe: 'H4',
    volatilityMin: null,
    volatilityMax: null,
    dayOfWeek: [1, 2, 3, 4],
    enabledPatterns: ['bos', 'fvg', 'liquidity_sweep'],
  })

  const metrics = JSON.stringify({
    winRate: 62.4, profitFactor: 1.87, maxDrawdown: 8.3, netProfit: 24750,
    totalTrades: 342, averageRR: 2.14, expectedValue: 72.37,
    sharpeRatio: 1.94, recoveryFactor: 2.98, maxWinStreak: 7, maxLossStreak: 4,
  })

  insertVersion.run(
    'sv-mb-v321', 'str-momentum-breakout', 'v3.2.1', 12,
    rules, filters, metrics, 'Added FVG confirmation filter, enabled London session',
  )

  db.prepare('UPDATE strategies SET current_version_id = ? WHERE id = ?').run(
    'sv-mb-v321', 'str-momentum-breakout',
  )

  console.log('✓ Seed data inserted.')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) seed()
