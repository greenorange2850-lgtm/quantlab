import { describe, expect, it } from 'vitest'
import {
  BUILTIN_PLAYBOOKS,
  canonicalStringify,
  definitionIsValid,
  playbookRegistry,
} from '../index.js'

describe('playbook definitions', () => {
  it('exposes exactly four built-in playbooks', () => {
    expect(BUILTIN_PLAYBOOKS).toHaveLength(4)
    expect(playbookRegistry.list()).toHaveLength(4)
  })

  it('exposes one definition per bias/kind combination', () => {
    for (const bias of ['bullish', 'bearish'] as const) {
      for (const kind of ['qml-reversal', 'continuation'] as const) {
        const d = playbookRegistry.find(bias, kind)
        expect(d).not.toBeNull()
        expect(d!.bias).toBe(bias)
        expect(d!.kind).toBe(kind)
      }
    }
  })

  it('registers all four built-ins by id', () => {
    for (const d of BUILTIN_PLAYBOOKS) {
      expect(playbookRegistry.has(d.id)).toBe(true)
      expect(playbookRegistry.get(d.id)).toBe(d)
    }
  })

  it('rejects unknown playbook ids', () => {
    expect(playbookRegistry.get('no-such-playbook')).toBeNull()
  })

  it('freezes definitions so they cannot be mutated', () => {
    for (const d of BUILTIN_PLAYBOOKS) {
      expect(Object.isFrozen(d)).toBe(true)
      const mutate = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(d as any).name = 'mutated'
      }
      expect(mutate).toThrow()
    }
  })

  it('passes structural validation for every definition', () => {
    for (const d of BUILTIN_PLAYBOOKS) {
      expect(definitionIsValid(d)).toBe(true)
    }
  })

  it('keeps definitions versioned and schema-versioned', () => {
    for (const d of BUILTIN_PLAYBOOKS) {
      expect(d.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(d.schemaVersion).toBeGreaterThanOrEqual(1)
    }
  })

  it('embeds a stable canonical serialized payload', () => {
    for (const d of BUILTIN_PLAYBOOKS) {
      // The embedded payload is the canonical (sorted-key) form of the
      // definition data — re-stringifying it is byte-identical.
      expect(canonicalStringify(JSON.parse(d.serialized))).toBe(d.serialized)
      expect(JSON.parse(d.serialized).id).toBe(d.id)
    }
  })

  it('declares unique parameter keys and check ids', () => {
    for (const d of BUILTIN_PLAYBOOKS) {
      const keys = d.parameterSchema.map((p) => p.key)
      expect(new Set(keys).size).toBe(keys.length)
      const ids = d.checks.map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('mirrors bullish/bearish QML check labels', () => {
    const bull = playbookRegistry.get('bullish-qml-reversal')!
    const bear = playbookRegistry.get('bearish-qml-reversal')!
    const swapped: Array<[string, string]> = [
      ['Bearish context', 'Bullish context'],
      ['Lower highs + lower lows structure', 'Higher highs + higher lows structure'],
      ['Break above latest valid LH', 'Break below latest valid HL'],
      ['Bullish CHoCH', 'Bearish CHoCH'],
      ['Broken LH becomes QML zone', 'Broken HL becomes QML zone'],
      ['Sell-side liquidity sweep', 'Buy-side liquidity sweep'],
      ['Bullish rejection', 'Bearish rejection'],
    ]
    const bullById = new Map(bull.checks.map((c) => [c.id, c.label]))
    for (const [bullishLabel, bearishLabel] of swapped) {
      const id = bull.checks.find((c) => c.label === bullishLabel)!.id
      expect(bear.checks.find((c) => c.id === id)!.label).toBe(bearishLabel)
      expect(bullById.get(id)).toBe(bullishLabel)
    }
  })

  it('includes the four required QML checks and the continuation required checks', () => {
    for (const id of ['bullish-qml-reversal', 'bearish-qml-reversal']) {
      const d = playbookRegistry.get(id)!
      const required = d.checks.filter((c) => c.required).map((c) => c.id)
      expect(required).toEqual([
        'qml-context',
        'qml-lh-ll',
        'qml-break',
        'qml-choch',
        'qml-zone',
        'qml-retest',
      ])
    }
    for (const id of ['bullish-continuation', 'bearish-continuation']) {
      const d = playbookRegistry.get(id)!
      const required = d.checks.filter((c) => c.required).map((c) => c.id)
      expect(required).toEqual(['cont-bos', 'cont-zone', 'cont-zone-alive', 'cont-conflict'])
    }
  })
})
