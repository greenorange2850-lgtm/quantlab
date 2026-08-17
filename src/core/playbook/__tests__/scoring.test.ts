import { describe, expect, it } from 'vitest'
import {
  OPTIONAL_WEIGHT,
  REQUIRED_WEIGHT,
  clamp,
  round1,
  scoreSetupStrength,
} from '../index.js'
import type { PlaybookCheck, ZoneSnapshot } from '../index.js'

function checks(passedRequired: number, totalRequired: number, passedOptional: number, totalOptional: number): PlaybookCheck[] {
  const out: PlaybookCheck[] = []
  for (let i = 0; i < totalRequired; i++) {
    out.push({ id: `r${i}`, label: `r${i}`, required: true, passed: i < passedRequired })
  }
  for (let i = 0; i < totalOptional; i++) {
    out.push({ id: `o${i}`, label: `o${i}`, required: false, passed: i < passedOptional })
  }
  return out
}

function zone(partial: Partial<ZoneSnapshot>): ZoneSnapshot {
  return {
    kind: 'qml',
    direction: 'long',
    zone: { top: 100, bottom: 95 },
    formedAtTimestamp: 'x',
    formedAtIndex: 0,
    touchedCount: 1,
    ageBars: 3,
    invalidated: false,
    expired: false,
    label: 'zone',
    ...partial,
  }
}

describe('playbook scoring', () => {
  it('clamps and rounds helpers', () => {
    expect(clamp(150)).toBe(100)
    expect(clamp(-5)).toBe(0)
    expect(round1(12.345)).toBe(12.3)
    expect(REQUIRED_WEIGHT + OPTIONAL_WEIGHT).toBe(1)
  })

  it('scores a perfect setup near 100 with healthy zone modifiers', () => {
    const score = scoreSetupStrength({
      checks: checks(6, 6, 5, 5),
      zone: zone({ touchedCount: 0, ageBars: 2 }),
      maxTouches: 3,
      maxZoneAge: 20,
    })
    // 100 base + zone bonuses (fresh, young, alive) but clamped to 100.
    expect(score).toBe(100)
  })

  it('scores 0 when no required checks pass', () => {
    const score = scoreSetupStrength({
      checks: checks(0, 6, 0, 2),
      zone: null,
      maxTouches: 3,
      maxZoneAge: 20,
    })
    expect(score).toBe(0)
  })

  it('reflects the required pass ratio under the 0.7/0.3 weighting', () => {
    // All required pass, no optional pass → 70 + optional floor.
    const allRequired = scoreSetupStrength({
      checks: checks(4, 4, 0, 2),
      zone: null,
      maxTouches: 3,
      maxZoneAge: 20,
    })
    expect(allRequired).toBe(70)
    // All required pass + half of the optional checks → 85.
    const withOptional = scoreSetupStrength({
      checks: checks(4, 4, 1, 2),
      zone: null,
      maxTouches: 3,
      maxZoneAge: 20,
    })
    expect(withOptional).toBe(85)
  })

  it('stays within [0, 100] regardless of modifiers', () => {
    for (let i = 0; i <= 6; i++) {
      for (let j = 0; j <= 6; j++) {
        const score = scoreSetupStrength({
          checks: checks(i, 6, j, 5),
          zone: zone({ touchedCount: 0, ageBars: 1 }),
          maxTouches: 3,
          maxZoneAge: 20,
        })
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      }
    }
  })

  it('zone-quality modifiers reward fresh, young, alive zones', () => {
    const base = scoreSetupStrength({
      checks: checks(5, 6, 4, 5),
      zone: zone({ touchedCount: 2, ageBars: 15, invalidated: false }),
      maxTouches: 3,
      maxZoneAge: 20,
    })
    const pristine = scoreSetupStrength({
      checks: checks(5, 6, 4, 5),
      zone: zone({ touchedCount: 0, ageBars: 2, invalidated: false }),
      maxTouches: 3,
      maxZoneAge: 20,
    })
    expect(pristine).toBeGreaterThan(base)
  })
})
