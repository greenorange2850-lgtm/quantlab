import { runRandomSearch, DEFAULT_MA_CROSS_RANGES } from '../index.js'
import type { Candle } from '../../../data/candles.js'
import type { RandomSearchPerfDiagnostics } from '../cooperative-schedule.js'

function buildCandles(count: number): Candle[] {
  let price = 100
  const candles: Candle[] = []
  for (let i = 0; i < count; i++) {
    price = i % 20 < 10 ? price * 1.01 : price * 0.99
    const open = price
    const close = price * (i % 2 === 0 ? 1.002 : 0.998)
    candles.push({
      time: Date.parse('2024-01-01T00:00:00.000Z') + i * 3_600_000,
      open,
      high: Math.max(open, close) * 1.001,
      low: Math.min(open, close) * 0.999,
      close,
      volume: 10 + i,
    })
  }
  return candles
}

async function main() {
  const candles = buildCandles(200)
  // UI validates iterations ≤ 500; 1000 is covered by the busy-wait blocking probe.
  const sizes = [200, 500]

  for (const n of sizes) {
    let progressBeforeFinal = 0
    let diagnostics: RandomSearchPerfDiagnostics | null = null
    const started = performance.now()
    const result = await runRandomSearch({
      candles,
      cooperativeBatchSize: 1,
      enablePerfDiagnostics: true,
      onPerfDiagnostics: (d) => {
        diagnostics = d
      },
      onProgress: (p) => {
        if (p.candidatesTested > 0 && p.status !== 'FINALIZING') progressBeforeFinal += 1
      },
      config: {
        iterations: n,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 200,
        initialCapital: 10_000,
        seed: 7,
      },
    })
    const wall = performance.now() - started
    console.log(`candidates=${n}`)
    console.log(
      `  wall=${wall.toFixed(0)}ms status=${result.status} evaluated=${result.candidates.length}`,
    )
    console.log(
      `  progressEventsBeforeFinal=${progressBeforeFinal} bestScore=${result.progress.bestScore}`,
    )
    console.log('  diagnostics', diagnostics)
  }

  // Determinism check: same seed ⇒ same scores with cooperative batching.
  const a = await runRandomSearch({
    candles,
    cooperativeBatchSize: 1,
    config: {
      iterations: 50,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 200,
      initialCapital: 10_000,
      seed: 99,
    },
  })
  const b = await runRandomSearch({
    candles,
    cooperativeBatchSize: 3,
    config: {
      iterations: 50,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 200,
      initialCapital: 10_000,
      seed: 99,
    },
  })
  const same =
    JSON.stringify(a.candidates.map((c) => [c.parameters, c.score])) ===
    JSON.stringify(b.candidates.map((c) => [c.parameters, c.score]))
  console.log(`\ndeterminism(batch1 vs batch3, n=50): ${same ? 'PASS' : 'FAIL'}`)
}

void main()
