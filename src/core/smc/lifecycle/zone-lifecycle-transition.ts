import type {
  ZoneLifecycleState,
  ZoneLifecycleTransitionInput,
  ZoneLifecycleTransitionResult,
} from './zone-lifecycle-types'

const TERMINAL: ReadonlySet<ZoneLifecycleState> = new Set([
  'EXPIRED',
  'CONSUMED',
])

function fail(from: ZoneLifecycleState, reason: string): ZoneLifecycleTransitionResult {
  return { ok: false, to: from, reason }
}

function ok(to: ZoneLifecycleState, reason: string): ZoneLifecycleTransitionResult {
  return { ok: true, to, reason }
}

/**
 * Deterministic lifecycle transition table.
 * Invalid transitions leave state unchanged and return ok:false.
 */
export function transitionZoneLifecycle(
  input: ZoneLifecycleTransitionInput,
): ZoneLifecycleTransitionResult {
  const { from, event, family } = input

  if (TERMINAL.has(from) && event !== 'EXPIRE') {
    return fail(from, `Terminal state ${from} rejects ${event}.`)
  }

  // Liquidity / equal-level path: ACTIVE → SWEEPED/SWEPT → CONSUMED
  if (family === 'LIQUIDITY' || family === 'EQUAL_LEVEL') {
    switch (event) {
      case 'PROMOTE':
        if (from === 'NEW') return ok('ACTIVE', 'Promoted NEW → ACTIVE.')
        return fail(from, `PROMOTE invalid from ${from} on ${family}.`)
      case 'SWEEP':
        if (from === 'ACTIVE' || from === 'NEW' || from === 'TOUCHED') {
          return ok(family === 'EQUAL_LEVEL' ? 'SWEPT' : 'SWEEPED', `Swept from ${from}.`)
        }
        return fail(from, `SWEEP invalid from ${from}.`)
      case 'CONSUME':
        if (from === 'SWEEPED' || from === 'SWEPT' || from === 'ACTIVE') {
          return ok('CONSUMED', `Consumed from ${from}.`)
        }
        return fail(from, `CONSUME invalid from ${from}.`)
      case 'INVALIDATE':
        if (from === 'ACTIVE' || from === 'NEW' || from === 'TOUCHED') {
          return ok('INVALIDATED', `Invalidated from ${from}.`)
        }
        return fail(from, `INVALIDATE invalid from ${from}.`)
      case 'EXPIRE':
        if (from === 'MITIGATED' || from === 'INVALIDATED' || from === 'SWEEPED' || from === 'SWEPT') {
          return ok('EXPIRED', `Expired from ${from}.`)
        }
        if (from === 'EXPIRED' || from === 'CONSUMED') {
          return ok(from, 'Already terminal.')
        }
        return fail(from, `EXPIRE invalid from ${from}.`)
      case 'TOUCH':
      case 'PARTIAL_FILL':
      case 'FULL_FILL':
      case 'MITIGATE':
        return fail(from, `${event} not used for ${family}.`)
      default:
        return fail(from, `Unknown event.`)
    }
  }

  // FVG / Order Block path: NEW → ACTIVE → TOUCHED → PARTIAL → MITIGATED → EXPIRED
  // or ACTIVE → INVALIDATED
  switch (event) {
    case 'PROMOTE':
      if (from === 'NEW') return ok('ACTIVE', 'Promoted NEW → ACTIVE.')
      return fail(from, `PROMOTE invalid from ${from}.`)
    case 'TOUCH':
      if (from === 'NEW' || from === 'ACTIVE') {
        return ok('TOUCHED', `First touch from ${from}.`)
      }
      if (from === 'TOUCHED') return ok('TOUCHED', 'Additional touch.')
      return fail(from, `TOUCH invalid from ${from}.`)
    case 'PARTIAL_FILL':
      if (
        from === 'ACTIVE' ||
        from === 'TOUCHED' ||
        from === 'PARTIAL' ||
        from === 'NEW'
      ) {
        return ok('PARTIAL', `Partial fill from ${from}.`)
      }
      return fail(from, `PARTIAL_FILL invalid from ${from}.`)
    case 'FULL_FILL':
    case 'MITIGATE':
      if (
        from === 'ACTIVE' ||
        from === 'TOUCHED' ||
        from === 'PARTIAL' ||
        from === 'NEW'
      ) {
        return ok('MITIGATED', `Mitigated from ${from}.`)
      }
      return fail(from, `${event} invalid from ${from}.`)
    case 'INVALIDATE':
      if (
        from === 'NEW' ||
        from === 'ACTIVE' ||
        from === 'TOUCHED' ||
        from === 'PARTIAL'
      ) {
        return ok('INVALIDATED', `Invalidated from ${from}.`)
      }
      return fail(from, `INVALIDATE invalid from ${from}.`)
    case 'EXPIRE':
      if (from === 'MITIGATED' || from === 'INVALIDATED') {
        return ok('EXPIRED', `Expired from ${from}.`)
      }
      if (from === 'EXPIRED') return ok('EXPIRED', 'Already expired.')
      return fail(from, `EXPIRE invalid from ${from}.`)
    case 'SWEEP':
    case 'CONSUME':
      return fail(from, `${event} not used for ${family}.`)
    default:
      return fail(from, 'Unknown event.')
  }
}

/** Whether a state is still considered "live" for extent extension. */
export function isLiveLifecycleState(state: ZoneLifecycleState): boolean {
  return (
    state === 'NEW' ||
    state === 'ACTIVE' ||
    state === 'TOUCHED' ||
    state === 'PARTIAL'
  )
}

/** Whether a state is terminal / finished. */
export function isTerminalLifecycleState(state: ZoneLifecycleState): boolean {
  return (
    state === 'MITIGATED' ||
    state === 'INVALIDATED' ||
    state === 'EXPIRED' ||
    state === 'SWEEPED' ||
    state === 'SWEPT' ||
    state === 'CONSUMED'
  )
}
