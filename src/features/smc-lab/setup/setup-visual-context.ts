import type { SmcSetupVisualContext } from '@/core/smc'
import { toSetupVisualContext, type TradingSetup } from '@/core/setup'

/** Chart focus context from a Setup Engine result. */
export function createSetupEngineVisualContext(setup: TradingSetup): SmcSetupVisualContext {
  return toSetupVisualContext(setup)
}
