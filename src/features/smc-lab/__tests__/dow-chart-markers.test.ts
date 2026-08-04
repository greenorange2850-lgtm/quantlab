import { describe, expect, it } from 'vitest'
import {
  analyzeDowTheory,
  DEFAULT_SMC_DETECTOR_CONFIG,
  detectSmc,
  filterDetectionByRanking,
  projectSmcLifecycle,
  withSmcVisibilityMode,
} from '@/core/smc'
import {
  diagnoseDowChartJoin,
  formatSwingChartLabel,
  projectSwingChartMarkers,
  resolveDowSwingLabel,
} from '@/features/smc-lab/dow-label'
import type { Candle } from '@/data/candles'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

function candle(i: number, o: number, h: number, l: number, c: number): Candle {
  return { time: 1_700_000_000_000 + i * 3_600_000, open: o, high: h, low: l, close: c, volume: 1 }
}

/** Real-ish pipeline fixture with clear external pivots (not a synthetic standalone map). */
function makePipelineFixture(n = 180): Candle[] {
  const candles: Candle[] = Array.from({ length: n }, (_, i) => {
    const base = 1000 + i * 0.6 + Math.sin(i / 6) * 18 + Math.cos(i / 13) * 8
    return candle(i, base, base + 5 + (i % 6), base - 5 - (i % 4), base + ((i % 3) - 1))
  })
  const pivots: Array<[number, number, number, number, number]> = [
    [25, 1040, 1120, 1030, 1100],
    [55, 980, 990, 900, 920],
    [90, 1080, 1180, 1070, 1160],
    [120, 1000, 1010, 920, 940],
    [150, 1120, 1220, 1110, 1200],
  ]
  for (const [i, o, h, l, c] of pivots) {
    if (i < n) candles[i] = candle(i, o, h, l, c)
  }
  return candles
}

function progressiveFilter(detection: ReturnType<typeof detectSmc>, visibleIndex: number) {
  const byIndex = <T extends { candleIndex: number; confirmedAtIndex?: number }>(events: T[]): T[] =>
    events.filter((e) =>
      typeof e.confirmedAtIndex === 'number'
        ? e.confirmedAtIndex <= visibleIndex
        : e.candleIndex <= visibleIndex,
    )
  return {
    ...detection,
    swings: byIndex(detection.swings),
    classifiedSwings: byIndex(detection.classifiedSwings),
    bosEvents: byIndex(detection.bosEvents),
    chochEvents: byIndex(detection.chochEvents),
    displacementEvents: byIndex(detection.displacementEvents),
    fvgEvents: byIndex(detection.fvgEvents),
    equalLevelEvents: byIndex(detection.equalLevelEvents),
    liquiditySweepEvents: byIndex(detection.liquiditySweepEvents),
    orderBlockEvents: byIndex(detection.orderBlockEvents),
  }
}

describe('Dow chart markers (real pipeline fixture)', () => {
  it('7) ranking-visible chart markers retain Dow suffix', () => {
    const candles = makePipelineFixture()
    const raw = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const detection = withSmcVisibilityMode(raw, 'balanced')
    const visibleIndex = candles.length - 1
    const progressive = progressiveFilter(detection, visibleIndex)
    const progressiveVisible = filterDetectionByRanking(progressive)
    const lifecycle = projectSmcLifecycle({
      detection: progressive,
      visibleIndex,
      preset: 'balanced',
    })
    const visibleIds = new Set(
      lifecycle.structureEvents.filter((s) => s.visible).map((s) => s.eventId),
    )
    const chartClassified = progressiveVisible.classifiedSwings.filter((e) =>
      visibleIds.has(e.id),
    )
    const dow = analyzeDowTheory(progressive.classifiedSwings, visibleIndex)
    const markers = projectSwingChartMarkers(
      chartClassified,
      dow.swingClassification,
      dow.bySwingId,
      true,
    )

    expect(markers.length).toBeGreaterThan(0)
    const withSuffix = markers.filter((m) => /·(HH|HL|LH|LL)$/.test(m.text))
    expect(withSuffix.length).toBeGreaterThan(0)

    // Trace one real visible swing through the identity chain.
    const sample = withSuffix[0]!
    const swing = chartClassified.find((s) => s.id === sample.id)!
    const diag = diagnoseDowChartJoin(
      {
        id: swing.id,
        originalSwingId: swing.originalSwingId,
        sourceSwingId: swing.originalSwingId,
        classification: swing.classification,
        kind: swing.kind,
      },
      dow.swingClassification,
      dow.bySwingId,
      true,
      swing.kind,
    )

    const dump = {
      rootCause:
        'Chart markers must join via classified event id (e-/i- + originalSwingId). Direct map[swing.id] works when identities align; wrappers need originalSwingId/sourceSwingId keys. Format must use middle-dot eSH·HH.',
      identityChain: {
        detectorSwingEventId: swing.originalSwingId,
        classifiedStructureSwingId: swing.id,
        originalSwingId: swing.originalSwingId,
        dowTheorySwingClassificationKey: diag.matchedLookupKey,
        dowTheoryValue: diag.matchedClassification,
        rankingVisible: progressiveVisible.classifiedSwings.some((s) => s.id === swing.id),
        structureVisible: visibleIds.has(swing.id),
        chartMarkerId: sample.id,
        finalFormattedMarkerLabel: sample.text,
      },
      diagnostics: {
        chartEventId: diag.chartEventId,
        originalSwingId: diag.originalSwingId,
        classificationLookupKeysTried: diag.classificationLookupKeysTried,
        matchedClassification: diag.matchedClassification,
        finalLabel: diag.finalLabel,
      },
      beforeAfter: {
        before: formatSwingChartLabel(swing.kind, undefined, true),
        after: sample.text,
      },
      renderedMarkerDump: markers.map((m) => ({ id: m.id, text: m.text, dowLabel: m.dowLabel })),
    }

    const outPath = '/opt/cursor/artifacts/dow-chart-marker-dump.json'
    try {
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, JSON.stringify(dump, null, 2))
    } catch {
      // Artifact dir may be unavailable in some runners — still assert below.
    }

    expect(diag.matchedClassification).toMatch(/^(HH|HL|LH|LL)$/)
    expect(diag.finalLabel).toBe(sample.text)
    expect(sample.text).toMatch(/^(eSH|eSL|iSH|iSL)·(HH|HL|LH|LL)$/)

    // Exact id match on the real pipeline identity chain.
    expect(dow.swingClassification[swing.id]).toBe(diag.matchedClassification)
    expect(diag.classificationLookupKeysTried[0]).toBe(swing.id)
  })

  it('consumes result.dowTheory maps for rendered marker labels', () => {
    const candles = makePipelineFixture(180)
    const result = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    expect(result.dowTheory).toBeDefined()
    const map = result.dowTheory!.swingClassification
    const byId = result.dowTheory!.bySwingId
    const labeled = result.classifiedSwings.filter((s) => map[s.id] != null)
    expect(labeled.length).toBeGreaterThan(0)

    const markers = projectSwingChartMarkers(labeled, map, byId, true)
    for (const m of markers) {
      expect(m.text).toMatch(/·(HH|HL|LH|LL)$/)
      expect(m.text.startsWith('eS') || m.text.startsWith('iS')).toBe(true)
    }
  })

  it('9) progressive replay shows classification only when the swing is confirmed', () => {
    const candles = makePipelineFixture()
    const full = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const labeled = full.classifiedSwings.filter(
      (s) => full.dowTheory!.swingClassification[s.id] != null,
    )
    expect(labeled.length).toBeGreaterThan(0)
    const target = labeled.sort((a, b) => a.confirmedAtIndex - b.confirmedAtIndex)[
      Math.floor(labeled.length / 2)
    ]!

    const beforeConfirm = analyzeDowTheory(
      full.classifiedSwings,
      target.confirmedAtIndex - 1,
    )
    expect(beforeConfirm.swingClassification[target.id]).toBeUndefined()
    expect(
      resolveDowSwingLabel(target, beforeConfirm.swingClassification, beforeConfirm.bySwingId),
    ).toBeUndefined()
    expect(
      projectSwingChartMarkers([target], beforeConfirm.swingClassification, beforeConfirm.bySwingId, true)[0]
        ?.text,
    ).toMatch(/^(eSH|eSL|iSH|iSL)$/)

    const afterConfirm = analyzeDowTheory(full.classifiedSwings, target.confirmedAtIndex)
    expect(afterConfirm.swingClassification[target.id]).toBeDefined()
    const afterMarker = projectSwingChartMarkers(
      [target],
      afterConfirm.swingClassification,
      afterConfirm.bySwingId,
      true,
    )[0]!
    if (afterConfirm.swingClassification[target.id] != null) {
      expect(afterMarker.text).toMatch(/·(HH|HL|LH|LL)$/)
    } else {
      // Seed at first compare — structure only is correct.
      expect(afterMarker.text).toMatch(/^(eSH|eSL|iSH|iSL)$/)
    }
  })

  it('toggle off on pipeline markers hides Dow suffix only', () => {
    const candles = makePipelineFixture()
    const result = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const labeled = result.classifiedSwings.filter(
      (s) => result.dowTheory!.swingClassification[s.id] != null,
    )
    const on = projectSwingChartMarkers(
      labeled,
      result.dowTheory!.swingClassification,
      result.dowTheory!.bySwingId,
      true,
    )
    const off = projectSwingChartMarkers(
      labeled,
      result.dowTheory!.swingClassification,
      result.dowTheory!.bySwingId,
      false,
    )
    expect(on.some((m) => m.text.includes('·'))).toBe(true)
    expect(off.every((m) => !m.text.includes('·'))).toBe(true)
    expect(off.every((m) => /^(eSH|eSL|iSH|iSL)$/.test(m.text))).toBe(true)
  })
})
