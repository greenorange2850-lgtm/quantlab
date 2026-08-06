import { describe, expect, it } from 'vitest'
import {
  BULLISH_QML_REVERSAL,
  PLAYBOOK_SERIALIZATION_FORMAT,
  buildPlaybookConfig,
  configIsCurrent,
  defaultParameters,
  deserializeEvaluation,
  evaluatePlaybookAt,
  fingerprintPlaybookConfig,
  migratePlaybookConfig,
  parseSerialization,
  playbookRegistry,
  serializeEvaluation,
  serializePlaybookConfig,
  wrapSerialization,
} from '../index.js'
import { bullishQmlCandles } from './fixtures.js'

describe('playbook persistence', () => {
  it('builds a versioned config with a fingerprint', () => {
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    const config = buildPlaybookConfig(BULLISH_QML_REVERSAL, params, '2024-01-01T00:00:00.000Z')
    expect(config.schemaVersion).toBe(1)
    expect(config.playbookId).toBe('bullish-qml-reversal')
    expect(config.playbookVersion).toBe(BULLISH_QML_REVERSAL.version)
    expect(config.parameters).toEqual(params)
    expect(config.savedAt).toBe('2024-01-01T00:00:00.000Z')
    expect(config.fingerprint).toMatch(/^[0-9a-f]{8}$/)
    expect(configIsCurrent(config)).toBe(true)
  })

  it('fingerprints are deterministic and parameter-sensitive', () => {
    const p1 = defaultParameters(BULLISH_QML_REVERSAL)
    const p2 = { ...p1, rr: 3 }
    const f1 = fingerprintPlaybookConfig(BULLISH_QML_REVERSAL.id, BULLISH_QML_REVERSAL.version, p1)
    const f2 = fingerprintPlaybookConfig(BULLISH_QML_REVERSAL.id, BULLISH_QML_REVERSAL.version, p1)
    const f3 = fingerprintPlaybookConfig(BULLISH_QML_REVERSAL.id, BULLISH_QML_REVERSAL.version, p2)
    expect(f1).toBe(f2)
    expect(f1).not.toBe(f3)
  })

  it('serializes configs in the canonical format and parses them back', () => {
    const config = buildPlaybookConfig(BULLISH_QML_REVERSAL, defaultParameters(BULLISH_QML_REVERSAL))
    const raw = serializePlaybookConfig(config)
    const parsed = parseSerialization(raw)
    const payload = parsed.payload as { playbookId?: string; fingerprint?: string }
    expect(parsed.format).toBe(PLAYBOOK_SERIALIZATION_FORMAT)
    expect(payload.playbookId).toBe(config.playbookId)
    expect(payload.fingerprint).toBe(config.fingerprint)
  })

  it('wraps arbitrary payloads with the playbook format', () => {
    const wrapped = wrapSerialization({ hello: 1 })
    expect(wrapped.format).toBe(PLAYBOOK_SERIALIZATION_FORMAT)
    expect(parseSerialization(JSON.stringify(wrapped)).payload).toEqual({ hello: 1 })
  })

  it('rejects unknown serialization formats', () => {
    expect(() => parseSerialization('{"format":"other"}')).toThrow(/Unknown playbook serialization format/)
  })

  it('migrates a current config without changes', () => {
    const config = buildPlaybookConfig(BULLISH_QML_REVERSAL, defaultParameters(BULLISH_QML_REVERSAL))
    const { config: out, migrated, notes } = migratePlaybookConfig(config, [BULLISH_QML_REVERSAL])
    expect(migrated).toBe(false)
    expect(notes).toEqual([])
    expect(out).toEqual(config)
  })

  it('migrates an old schema version and recomputes the fingerprint', () => {
    const config = buildPlaybookConfig(BULLISH_QML_REVERSAL, defaultParameters(BULLISH_QML_REVERSAL))
    const old = { ...config, schemaVersion: 0, fingerprint: 'deadbeef' }
    const { config: out, migrated, notes } = migratePlaybookConfig(old, [BULLISH_QML_REVERSAL])
    expect(migrated).toBe(true)
    expect(notes.join(' | ')).toContain('Migrating schemaVersion 0')
    expect(notes.join(' | ')).toContain('Fingerprint recomputed')
    expect(out!.schemaVersion).toBe(1)
    expect(out!.fingerprint).toBe(config.fingerprint)
  })

  it('rejects unknown playbooks with a null config', () => {
    const { config: out, notes } = migratePlaybookConfig(
      { schemaVersion: 1, playbookId: 'unknown', parameters: {} },
      [BULLISH_QML_REVERSAL],
    )
    expect(out).toBeNull()
    expect(notes.join(' | ')).toContain('Unknown playbook')
  })

  it('rejects non-object payloads', () => {
    expect(migratePlaybookConfig(null, [BULLISH_QML_REVERSAL]).config).toBeNull()
    expect(migratePlaybookConfig('nope', [BULLISH_QML_REVERSAL]).config).toBeNull()
  })

  it('fills missing parameters with defaults and normalizes outliers', () => {
    const raw = {
      schemaVersion: 1,
      playbookId: 'bullish-qml-reversal',
      parameters: { rr: 500 },
    }
    const { config: out, notes } = migratePlaybookConfig(raw, [BULLISH_QML_REVERSAL])
    expect(out).not.toBeNull()
    expect(out!.parameters.rr).toBe(10) // clamped
    expect(out!.parameters.swingLookback).toBe(5) // default filled
    expect(notes.join(' | ')).toContain('normalized')
  })

  it('round-trips an evaluation through serialize/deserialize', () => {
    const candles = bullishQmlCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
    })
    const raw = serializeEvaluation(ev)
    const restored = deserializeEvaluation(BULLISH_QML_REVERSAL, raw)
    expect(restored.status).toBe(ev.status)
    expect(restored.action).toBe(ev.action)
    expect(restored.serialized).toBe(raw)
  })

  it('deserialization refuses evaluations from another playbook', () => {
    const candles = bullishQmlCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
    })
    const bearish = playbookRegistry.get('bearish-qml-reversal')!
    expect(() => deserializeEvaluation(bearish, ev.serialized)).toThrow(/belongs to/)
  })
})
