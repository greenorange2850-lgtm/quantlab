import { describe, expect, it } from 'vitest'
import {
  PLAYBOOK_STATUSES,
  PLAYBOOK_STATUS_TRANSITIONS,
  STATUS_LABELS,
  STATUS_ORDERS,
  assertTransition,
  canTransition,
  isTerminalStatus,
} from '../index.js'
import type { PlaybookStatus } from '../index.js'

describe('playbook status lifecycle', () => {
  it('defines the full status set and labels', () => {
    expect(PLAYBOOK_STATUSES).toEqual([
      'WATCHING',
      'WAITING_RETEST',
      'READY',
      'INVALIDATED',
      'COMPLETED',
      'EXPIRED',
    ])
    for (const s of PLAYBOOK_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy()
      expect(typeof STATUS_ORDERS[s]).toBe('number')
    }
  })

  it('marks terminal statuses as terminal and unreachable from themselves', () => {
    for (const s of ['INVALIDATED', 'COMPLETED', 'EXPIRED'] as PlaybookStatus[]) {
      expect(isTerminalStatus(s)).toBe(true)
      expect(PLAYBOOK_STATUS_TRANSITIONS[s]).toHaveLength(0)
    }
    for (const s of ['WATCHING', 'WAITING_RETEST', 'READY'] as PlaybookStatus[]) {
      expect(isTerminalStatus(s)).toBe(false)
    }
  })

  it('allows forward progress and forbids terminal rollback', () => {
    expect(canTransition('WATCHING', 'WAITING_RETEST')).toBe(true)
    expect(canTransition('WATCHING', 'READY')).toBe(true)
    expect(canTransition('WAITING_RETEST', 'READY')).toBe(true)
    expect(canTransition('READY', 'COMPLETED')).toBe(true)
    expect(canTransition('READY', 'INVALIDATED')).toBe(true)
    expect(canTransition('READY', 'EXPIRED')).toBe(true)
    // No backwards or terminal transitions.
    expect(canTransition('READY', 'WATCHING')).toBe(false)
    expect(canTransition('COMPLETED', 'READY')).toBe(false)
    expect(canTransition('INVALIDATED', 'WATCHING')).toBe(false)
    expect(canTransition('EXPIRED', 'READY')).toBe(false)
  })

  it('assertTransition agrees with canTransition', () => {
    expect(assertTransition('WATCHING', 'READY')).toBe(canTransition('WATCHING', 'READY'))
    expect(assertTransition('COMPLETED', 'WATCHING')).toBe(false)
  })
})
