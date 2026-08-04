export {
  SMC_LAB_TABS,
  DEFAULT_SMC_LAB_TAB,
  SMC_LAB_TAB_STORAGE_KEY,
  parseSmcLabTab,
  isSmcLabTab,
  loadStoredSmcLabTab,
  storeSmcLabTab,
  buildSmcLabTabSearchParams,
} from './tabs'
export type { SmcLabTabId, SmcLabTabDefinition } from './tabs'

export { useSmcLabTab } from './useSmcLabTab'

export { hasUnappliedDetectionConfig } from './dirty-config'

export { SmcLabWorkspaceTabs, nextSmcLabTabFromKey } from './SmcLabWorkspaceTabs'
export type { SmcLabWorkspaceTabsProps } from './SmcLabWorkspaceTabs'

export { SmcAppliedConfigSummary } from './SmcAppliedConfigSummary'
export type { SmcAppliedConfigSummaryProps } from './SmcAppliedConfigSummary'

export { SmcQuickViewControls } from './SmcQuickViewControls'
export type { SmcQuickViewControlsProps } from './SmcQuickViewControls'

export {
  SmcLabWorkspaceProvider,
  useSmcLabWorkspace,
} from './SmcLabWorkspaceContext'
export type { SmcLabWorkspaceModel } from './SmcLabWorkspaceContext'

export { SmcAnalyzeWorkspace } from './SmcAnalyzeWorkspace'
export { SmcConfigureWorkspace } from './SmcConfigureWorkspace'
export { SmcValidateWorkspace } from './SmcValidateWorkspace'
export { SmcDiagnosticsWorkspace } from './SmcDiagnosticsWorkspace'
