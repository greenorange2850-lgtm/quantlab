import type { SmcChartZoneState } from './types'
import type {
  ZoneLifecycleFamily,
  ZoneLifecycleMeta,
  ZoneLifecycleRenderStyle,
  ZoneLifecycleState,
} from './zone-lifecycle-types'

/**
 * Chart rendering style from Phase 6 lifecycle state.
 *
 * ACTIVE → solid
 * TOUCHED → slightly faded
 * PARTIAL → dashed
 * MITIGATED → low opacity
 * INVALIDATED → red cross
 * EXPIRED → hidden by default
 */
export function renderStyleForLifecycleState(
  state: ZoneLifecycleState,
): ZoneLifecycleRenderStyle {
  switch (state) {
    case 'NEW':
    case 'ACTIVE':
      return {
        opacity: 0.28,
        strokeDasharray: undefined,
        showInvalidationCross: false,
        hiddenByDefault: false,
        labelSuffix: '',
        fillClassHint: 'solid',
      }
    case 'TOUCHED':
      return {
        opacity: 0.2,
        strokeDasharray: undefined,
        showInvalidationCross: false,
        hiddenByDefault: false,
        labelSuffix: '·T',
        fillClassHint: 'faded',
      }
    case 'PARTIAL':
      return {
        opacity: 0.18,
        strokeDasharray: '4 3',
        showInvalidationCross: false,
        hiddenByDefault: false,
        labelSuffix: '·P',
        fillClassHint: 'dashed',
      }
    case 'MITIGATED':
    case 'SWEEPED':
    case 'SWEPT':
    case 'CONSUMED':
      return {
        opacity: 0.1,
        strokeDasharray: '2 3',
        showInvalidationCross: false,
        hiddenByDefault: false,
        labelSuffix: state === 'CONSUMED' ? '·C' : '·M',
        fillClassHint: 'low',
      }
    case 'INVALIDATED':
      return {
        opacity: 0.16,
        strokeDasharray: '3 2',
        showInvalidationCross: true,
        hiddenByDefault: false,
        labelSuffix: '·X',
        fillClassHint: 'invalid',
      }
    case 'EXPIRED':
      return {
        // Hidden by default via visibility; Debug may still render faintly.
        opacity: 0.06,
        strokeDasharray: '1 4',
        showInvalidationCross: false,
        hiddenByDefault: true,
        labelSuffix: '·E',
        fillClassHint: 'hidden',
      }
    default:
      return {
        opacity: 0.2,
        strokeDasharray: undefined,
        showInvalidationCross: false,
        hiddenByDefault: false,
        labelSuffix: '',
        fillClassHint: 'solid',
      }
  }
}

export function renderStyleForZone(zone: ZoneLifecycleMeta): ZoneLifecycleRenderStyle {
  return renderStyleForLifecycleState(zone.currentState)
}

/**
 * Map Phase 6 state → legacy chart state used by existing SmcZoneProjection consumers.
 * Keeps chart backward-compatible while the manager uses the new vocabulary.
 */
export function toChartZoneState(
  state: ZoneLifecycleState,
  family: ZoneLifecycleFamily = 'FVG',
): SmcChartZoneState {
  switch (state) {
    case 'NEW':
    case 'ACTIVE':
      return 'ACTIVE'
    case 'TOUCHED':
      return 'TOUCHED'
    case 'PARTIAL':
      return 'PARTIALLY_MITIGATED'
    case 'MITIGATED':
      // FVG historically used FILLED; OB used MITIGATED.
      return family === 'ORDER_BLOCK' ? 'MITIGATED' : 'FILLED'
    case 'INVALIDATED':
      return 'INVALIDATED'
    case 'EXPIRED':
      return 'EXPIRED'
    case 'SWEEPED':
    case 'SWEPT':
      return 'SWEPT'
    case 'CONSUMED':
      return 'SUPERSEDED'
    default:
      return 'ACTIVE'
  }
}

/** Map legacy chart state → Phase 6 (best-effort for mixed consumers). */
export function fromChartZoneState(state: SmcChartZoneState): ZoneLifecycleState {
  switch (state) {
    case 'ACTIVE':
      return 'ACTIVE'
    case 'TOUCHED':
      return 'TOUCHED'
    case 'PARTIALLY_MITIGATED':
      return 'PARTIAL'
    case 'MITIGATED':
    case 'FILLED':
      return 'MITIGATED'
    case 'INVALIDATED':
      return 'INVALIDATED'
    case 'EXPIRED':
      return 'EXPIRED'
    case 'SWEPT':
    case 'BROKEN':
      return 'SWEEPED'
    case 'SUPERSEDED':
      return 'CONSUMED'
    default:
      return 'ACTIVE'
  }
}

export function lifecycleStateLabel(state: ZoneLifecycleState): string {
  switch (state) {
    case 'NEW':
      return 'New'
    case 'ACTIVE':
      return 'Active'
    case 'TOUCHED':
      return 'Touched'
    case 'PARTIAL':
      return 'Partial'
    case 'MITIGATED':
      return 'Mitigated'
    case 'INVALIDATED':
      return 'Invalidated'
    case 'EXPIRED':
      return 'Expired'
    case 'SWEEPED':
    case 'SWEPT':
      return 'Swept'
    case 'CONSUMED':
      return 'Consumed'
    default:
      return state
  }
}
