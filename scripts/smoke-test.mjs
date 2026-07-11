/**
 * CI smoke test — import → scan → analyze pipeline.
 * Requires packages to be built (npm run build:packages).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { migrate, createRepositories, closeDatabase } from '@trading-os/database'
import { createMarketDataEngine } from '@trading-os/market-data'
import { createRuleEngine } from '@trading-os/rule-engine'
import { createMarketIntelligence } from '@trading-os/market-intelligence'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  console.log('[smoke] migrating database...')
  migrate()

  const repos = createRepositories()
  const md = createMarketDataEngine(repos.marketDataEngine)

  const samplePath = join(root, 'public', 'samples', 'xauusd-h1-sample.csv')
  const csv = readFileSync(samplePath)

  console.log('[smoke] importing sample candles...')
  const importResult = await md.import.import('csv', 'XAUUSD', 'H1', csv, 'xauusd-h1-sample.csv')
  if (!importResult.job?.rowsImported || importResult.job.rowsImported < 1) {
    throw new Error('Smoke import failed: no rows imported')
  }

  console.log('[smoke] running rule scan...')
  const rules = createRuleEngine(repos.marketDataEngine, repos.ruleEngine)
  const scan = await rules.scan.scan({ symbol: 'XAUUSD', timeframe: 'H1' })
  if (scan.eventsFound < 1) {
    throw new Error(`Smoke scan failed: expected events, got ${scan.eventsFound}`)
  }

  console.log('[smoke] running intelligence analysis...')
  const eventSource = { getEvents: (p) => repos.ruleEngine.getEvents(p) }
  const intel = createMarketIntelligence(repos.marketDataEngine, eventSource, repos.marketIntelligence)
  const analysis = await intel.analyze.analyze({ symbol: 'XAUUSD', timeframe: 'H1' })
  if (analysis.eventsAnalyzed < 1) {
    throw new Error(`Smoke analyze failed: expected enriched events, got ${analysis.eventsAnalyzed}`)
  }

  console.log('[smoke] OK —', {
    imported: importResult.job.rowsImported,
    events: scan.eventsFound,
    enriched: analysis.eventsAnalyzed,
  })

  closeDatabase()
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err)
  process.exit(1)
})
