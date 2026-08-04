import { describe, expect, it } from 'vitest'
import { detectSmc, DEFAULT_SMC_DETECTOR_CONFIG } from '@/core/smc'
import {
  formatSwingChartLabel,
  resolveDowSwingLabel,
} from '@/features/smc-lab/dow-label'
import type { Candle } from '@/data/candles'

function candle(i: number, o: number, h: number, l: number, c: number): Candle {
  return { time: 1700000000000 + i * 3600000, open: o, high: h, low: l, close: c, volume: 1 }
}

describe('dow chart id wiring', () => {
  it('consumes result.dowTheory.swingClassification for rendered swing labels', () => {
    const n = 120
    const candles: Candle[] = Array.from({ length: n }, (_, i) => {
      const base = 1000 + i * 0.8 + Math.sin(i / 5) * 12
      return candle(i, base, base + 4 + (i % 7), base - 4 - (i % 5), base)
    })
    candles[20] = candle(20, 1070, 1080, 1060, 1070)
    candles[40] = candle(40, 990, 1000, 980, 990)
    candles[60] = candle(60, 1110, 1120, 1100, 1110)
    candles[80] = candle(80, 1010, 1020, 1000, 1010)
    candles[100] = candle(100, 1150, 1160, 1140, 1150)

    const result = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    expect(result.dowTheory).toBeDefined()
    const map = result.dowTheory!.swingClassification
    const byId = result.dowTheory!.bySwingId
    const labeled = result.classifiedSwings.filter((s) => map[s.id] != null)
    expect(labeled.length).toBeGreaterThan(0)

    for (const s of labeled) {
      const resolved = resolveDowSwingLabel(s, map, byId)
      expect(resolved).toBe(map[s.id])
      const text = formatSwingChartLabel(s.kind, resolved, true)
      expect(text).toMatch(/ (HH|HL|LH|LL)$/)
      expect(text.startsWith('eS') || text.startsWith('iS')).toBe(true)
    }
  })
})
