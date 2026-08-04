import { describe, expect, it } from 'vitest'
import {
  analyzeDowTheory,
  DEFAULT_SMC_DETECTOR_CONFIG,
  detectSmc,
  filterDetectionByRanking,
  projectSmcLifecycle,
  withSmcVisibilityMode,
  type SmcClassifiedSwingEvent,
  type SmcDetectionResult,
} from '@/core/smc'
import {
  formatSwingChartLabel,
  projectSwingChartMarkers,
} from '@/features/smc-lab/dow-label'
import {
  mergeDowProtectedSwings,
  projectDowChartVisibility,
} from '@/features/smc-lab/dow-visibility'
import { layersForDensityPreset } from '@/features/smc-lab/persistence/prefs-archive'
import type { Candle } from '@/data/candles'

function candle(i: number, o: number, h: number, l: number, c: number): Candle {
  return { time: 1_700_000_000_000 + i * 3_600_000, open: o, high: h, low: l, close: c, volume: 1 }
}

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

function progressiveFilter(detection: SmcDetectionResult, visibleIndex: number) {
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
  }
}

function chartClassifiedFor(
  detection: SmcDetectionResult,
  densityPreset: 'minimal' | 'structure' | 'liquidity' | 'full-debug',
  visibilityMode: 'focus' | 'balanced' | 'debug',
  showDow = true,
) {
  const ranked = withSmcVisibilityMode(detection, visibilityMode)
  const visibleIndex = Math.max(0, ranked.diagnostics.candleCount - 1)
  const progressive = progressiveFilter(ranked, visibleIndex)
  const progressiveVisible = filterDetectionByRanking(progressive)
  const lifecycle = projectSmcLifecycle({
    detection: progressive,
    visibleIndex,
    preset: 'balanced',
  })
  const dow = analyzeDowTheory(progressive.classifiedSwings, visibleIndex)
  const dowVis = projectDowChartVisibility({
    classifiedSwings: progressive.classifiedSwings,
    swingClassification: dow.swingClassification,
    bySwingId: dow.bySwingId,
    densityPreset,
    visibilityMode,
    intelligence: ranked.intelligence,
    structureEvents: lifecycle.structureEvents,
    selectedEventId: null,
    visibleIndex,
    showDowTheoryLabels: showDow,
  })

  const visibleIds = new Set(
    lifecycle.structureEvents.filter((s) => s.visible).map((s) => s.eventId),
  )
  const base =
    visibilityMode === 'debug'
      ? progressiveVisible.classifiedSwings
      : progressiveVisible.classifiedSwings.filter((e) => visibleIds.has(e.id))

  const layers = layersForDensityPreset(densityPreset)
  const merged = mergeDowProtectedSwings(base, dowVis.visibleSwings).filter((s) => {
    if (s.classification === 'EXTERNAL') return layers.externalSwings
    if (s.classification === 'INTERNAL') return layers.internalSwings
    return false
  })

  const markers = projectSwingChartMarkers(
    merged,
    dow.swingClassification,
    dow.bySwingId,
    showDow,
  )

  return { ranked, progressive, dow, dowVis, merged, markers, layers }
}

describe('Dow chart visibility UX', () => {
  it('Minimal preserves current external Dow labels', () => {
    const candles = makePipelineFixture()
    const detection = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const { markers, dowVis } = chartClassifiedFor(detection, 'minimal', 'balanced', true)

    const externalLabeled = markers.filter((m) => /^eS[HL]·(HH|HL|LH|LL)$/.test(m.text))
    expect(externalLabeled.length).toBeGreaterThan(0)
    expect(markers.every((m) => !m.text.startsWith('iS'))).toBe(true)
    expect(dowVis.diagnostics.chartRenderedDowCount).toBeGreaterThan(0)
    expect(dowVis.notice).toBeNull()
  })

  it('Balanced preserves external Dow labels', () => {
    const candles = makePipelineFixture()
    const detection = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const { markers, dowVis } = chartClassifiedFor(detection, 'structure', 'balanced', true)

    const externalLabeled = markers.filter((m) => /^eS[HL]·(HH|HL|LH|LL)$/.test(m.text))
    expect(externalLabeled.length).toBeGreaterThan(0)
    expect(dowVis.diagnostics.chartRenderedDowCount).toBeGreaterThan(0)

    // Without Dow protection, Balanced ranking strips most internals — externals must remain.
    const unprotected = filterDetectionByRanking(
      withSmcVisibilityMode(detection, 'balanced'),
    ).classifiedSwings.filter((s) => s.classification === 'EXTERNAL')
    expect(unprotected.length).toBeGreaterThan(0)
  })

  it('Structure shows ranked internal labels', () => {
    const candles = makePipelineFixture()
    const detection = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const { markers, dowVis, layers } = chartClassifiedFor(
      detection,
      'structure',
      'balanced',
      true,
    )

    expect(layers.internalSwings).toBe(true)
    // Balanced protects top-ranked internals for Dow — at least one internal suffix when present.
    const internalDow = dowVis.renderedDowSwings.filter((s) => s.classification === 'INTERNAL')
    if (dowVis.diagnostics.classifiedDowCount > 0) {
      const internalClassified = Object.entries(
        analyzeDowTheory(
          progressiveFilter(detection, candles.length - 1).classifiedSwings,
          candles.length - 1,
        ).swingClassification,
      ).filter(([id, label]) => label != null && id.startsWith('i-'))
      if (internalClassified.length > 0) {
        expect(internalDow.length).toBeGreaterThan(0)
        expect(markers.some((m) => /^iS[HL]·(HH|HL|LH|LL)$/.test(m.text))).toBe(true)
      }
    }
  })

  it('Debug shows all labels', () => {
    const candles = makePipelineFixture()
    const detection = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const { markers, dowVis } = chartClassifiedFor(detection, 'full-debug', 'debug', true)

    expect(dowVis.diagnostics.chartRenderedDowCount).toBe(
      dowVis.diagnostics.classifiedDowCount,
    )
    expect(dowVis.diagnostics.hiddenByDensity).toBe(0)
    expect(dowVis.diagnostics.hiddenByRanking).toBe(0)
    expect(markers.filter((m) => m.dowLabel != null).length).toBe(
      dowVis.diagnostics.classifiedDowCount,
    )
  })

  it('toggle ON/OFF affects suffix only', () => {
    const candles = makePipelineFixture()
    const detection = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const on = chartClassifiedFor(detection, 'minimal', 'balanced', true)
    const off = chartClassifiedFor(detection, 'minimal', 'balanced', false)

    expect(on.merged.map((s) => s.id).sort()).toEqual(off.merged.map((s) => s.id).sort())
    expect(on.markers.some((m) => m.text.includes('·'))).toBe(true)
    expect(off.markers.every((m) => !m.text.includes('·'))).toBe(true)
    expect(off.markers.every((m) => /^(eSH|eSL|iSH|iSL)$/.test(m.text))).toBe(true)

    // Same swing, suffix only difference
    const sample = on.markers.find((m) => m.dowLabel != null)!
    const offSample = off.markers.find((m) => m.id === sample.id)!
    expect(offSample.text).toBe(formatSwingChartLabel(
      on.merged.find((s) => s.id === sample.id)!.kind,
      sample.dowLabel,
      false,
    ))
  })

  it('notice appears when classifications exist but none render', () => {
    const candles = makePipelineFixture()
    const detection = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const ranked = withSmcVisibilityMode(detection, 'focus')
    const visibleIndex = candles.length - 1
    const progressive = progressiveFilter(ranked, visibleIndex)
    const dow = analyzeDowTheory(progressive.classifiedSwings, visibleIndex)

    // Force empty render: Focus with a non-matching selection and no current externals overlap
    // by using an impossible selected id and zero current/recent window.
    const dowVis = projectDowChartVisibility({
      classifiedSwings: progressive.classifiedSwings,
      swingClassification: dow.swingClassification,
      bySwingId: dow.bySwingId,
      densityPreset: 'minimal',
      visibilityMode: 'focus',
      intelligence: ranked.intelligence,
      structureEvents: [],
      selectedEventId: 'no-such-swing',
      visibleIndex,
      showDowTheoryLabels: true,
      currentExternalCount: 0,
      recentContextBars: 0,
    })

    expect(dowVis.diagnostics.classifiedDowCount).toBeGreaterThan(0)
    expect(dowVis.diagnostics.chartRenderedDowCount).toBe(0)
    expect(dowVis.notice).not.toBeNull()
    expect(dowVis.notice!.message).toMatch(
      /Dow labels are enabled; \d+ classifications? (is|are) hidden by Density or Intelligence visibility\./,
    )
  })

  it('switching presets updates chart without rerunning detection', () => {
    const candles = makePipelineFixture()
    const detection = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const fingerprint = JSON.stringify({
      swings: detection.classifiedSwings.map((s) => s.id),
      dow: detection.dowTheory?.swingClassification,
    })

    const minimal = chartClassifiedFor(detection, 'minimal', 'balanced', true)
    const structure = chartClassifiedFor(detection, 'structure', 'balanced', true)
    const debug = chartClassifiedFor(detection, 'full-debug', 'debug', true)

    // Same underlying detection payload — only projection changes.
    expect(
      JSON.stringify({
        swings: detection.classifiedSwings.map((s) => s.id),
        dow: detection.dowTheory?.swingClassification,
      }),
    ).toBe(fingerprint)

    expect(minimal.dowVis.diagnostics.chartRenderedDowCount).toBeGreaterThan(0)
    expect(debug.dowVis.diagnostics.chartRenderedDowCount).toBeGreaterThanOrEqual(
      structure.dowVis.diagnostics.chartRenderedDowCount,
    )
    expect(debug.dowVis.diagnostics.chartRenderedDowCount).toBeGreaterThanOrEqual(
      minimal.dowVis.diagnostics.chartRenderedDowCount,
    )
  })

  it('exposes visibility diagnostics fields', () => {
    const candles = makePipelineFixture()
    const detection = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const { dowVis } = chartClassifiedFor(detection, 'minimal', 'balanced', true)
    expect(dowVis.diagnostics).toEqual(
      expect.objectContaining({
        classifiedDowCount: expect.any(Number),
        densityEligibleDowCount: expect.any(Number),
        rankingVisibleDowCount: expect.any(Number),
        chartRenderedDowCount: expect.any(Number),
        hiddenByDensity: expect.any(Number),
        hiddenByRanking: expect.any(Number),
      }),
    )
  })

  it('mergeDowProtectedSwings is stable and unique', () => {
    const a = {
      id: 'e-1',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 1,
    } as SmcClassifiedSwingEvent
    const b = {
      id: 'e-2',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 2,
    } as SmcClassifiedSwingEvent
    const merged = mergeDowProtectedSwings([a], [a, b])
    expect(merged.map((s) => s.id)).toEqual(['e-1', 'e-2'])
  })
})
