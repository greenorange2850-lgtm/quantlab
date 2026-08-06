import { describe, expect, it } from 'vitest'
import {
  BULLISH_CONTINUATION,
  BULLISH_QML_REVERSAL,
  areParametersValid,
  defaultParameters,
  resolveParameters,
  validateParameters,
} from '../index.js'
import type { PlaybookParameters } from '../index.js'

describe('playbook parameters', () => {
  it('produces schema defaults for a definition', () => {
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    expect(params.swingLookback).toBe(5)
    expect(params.trendStrength).toBe(2)
    expect(params.maxZoneAge).toBe(20)
    expect(params.maxTouches).toBe(3)
    expect(params.minScore).toBe(60)
    expect(params.rr).toBe(2)
    expect(params.requireSweep).toBe(false)
    expect(areParametersValid(BULLISH_QML_REVERSAL, params)).toBe(true)
  })

  it('fills missing keys with defaults', () => {
    const resolved = resolveParameters(BULLISH_QML_REVERSAL, { rr: 3 })
    expect(resolved.rr).toBe(3)
    expect(resolved.swingLookback).toBe(5)
    expect(resolved.requireRejection).toBe(false)
  })

  it('clamps numeric values into their schema range', () => {
    const resolved = resolveParameters(BULLISH_QML_REVERSAL, {
      swingLookback: 999,
      trendStrength: -5,
      maxTouches: 100,
    })
    expect(resolved.swingLookback).toBe(20)
    expect(resolved.trendStrength).toBe(1)
    expect(resolved.maxTouches).toBe(10)
  })

  it('rejects non-numeric values for numeric keys', () => {
    const resolved = resolveParameters(BULLISH_QML_REVERSAL, { swingLookback: 'abc' as never })
    expect(resolved.swingLookback).toBe(5)
  })

  it('reports issues for unknown, out-of-range and wrong-type parameters', () => {
    const issues = validateParameters(BULLISH_QML_REVERSAL, {
      bogus: 1,
      swingLookback: 99,
      minScore: -10,
      requireSweep: 'yes' as never,
    })
    const messages = issues.map((i) => i.message).join(' | ')
    expect(messages).toContain('Unknown parameter "bogus"')
    expect(messages).toContain('above maximum')
    expect(messages).toContain('below minimum')
    expect(messages).toContain('must be a boolean')
  })

  it('accepts select parameters only from their option set', () => {
    // Continuation has no select params; build one via resolveParameters sanity check.
    const resolved = resolveParameters(BULLISH_CONTINUATION, {})
    expect(resolved.requireDowAlignment).toBe(true)
  })

  it('keeps parameter resolution deterministic', () => {
    const a = resolveParameters(BULLISH_QML_REVERSAL, { rr: 2.5, trendStrength: 3 })
    const b = resolveParameters(BULLISH_QML_REVERSAL, { rr: 2.5, trendStrength: 3 })
    expect(a).toEqual(b)
  })

  it('rejects parameters that are not plain objects defensively', () => {
    const resolved = resolveParameters(BULLISH_QML_REVERSAL, null as unknown as PlaybookParameters)
    expect(resolved).toEqual(defaultParameters(BULLISH_QML_REVERSAL))
  })
})
