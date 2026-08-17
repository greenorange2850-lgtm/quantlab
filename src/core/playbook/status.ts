// ─── Playbook Engine — Status Lifecycle ───────────────────────────────────────
//
// Status is a deterministic state machine driven by setup facts. The evaluator
// resolves the state from data visible at the evaluation point; the backtest
// API advances post-READY states (COMPLETED / INVALIDATED / EXPIRED) using
// subsequent price action.

import type { PlaybookStatus } from './types.js'

export const PLAYBOOK_STATUSES: readonly PlaybookStatus[] = [
  'WATCHING',
  'WAITING_RETEST',
  'READY',
  'INVALIDATED',
  'COMPLETED',
  'EXPIRED',
]

/** Allowable lifecycle transitions. */
export const PLAYBOOK_STATUS_TRANSITIONS: Record<PlaybookStatus, readonly PlaybookStatus[]> = {
  WATCHING: ['WAITING_RETEST', 'READY', 'INVALIDATED', 'EXPIRED', 'COMPLETED'],
  WAITING_RETEST: ['READY', 'INVALIDATED', 'EXPIRED', 'COMPLETED'],
  READY: ['INVALIDATED', 'COMPLETED', 'EXPIRED'],
  INVALIDATED: [],
  COMPLETED: [],
  EXPIRED: [],
}

export function canTransition(from: PlaybookStatus, to: PlaybookStatus): boolean {
  return PLAYBOOK_STATUS_TRANSITIONS[from].includes(to)
}

export function assertTransition(from: PlaybookStatus, to: PlaybookStatus): boolean {
  return canTransition(from, to)
}

export const STATUS_LABELS: Record<PlaybookStatus, string> = {
  WATCHING: 'Watching',
  WAITING_RETEST: 'Waiting for retest',
  READY: 'Ready',
  INVALIDATED: 'Invalidated',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
}

export const STATUS_ORDERS: Record<PlaybookStatus, number> = {
  WATCHING: 0,
  WAITING_RETEST: 1,
  READY: 2,
  INVALIDATED: 3,
  COMPLETED: 3,
  EXPIRED: 3,
}

/** Terminal lifecycle states — no further transitions are legal. */
export function isTerminalStatus(status: PlaybookStatus): boolean {
  return status === 'INVALIDATED' || status === 'COMPLETED' || status === 'EXPIRED'
}
