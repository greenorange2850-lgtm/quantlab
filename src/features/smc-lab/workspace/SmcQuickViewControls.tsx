import { cn } from '@/lib/utils'
import type {
  SmcDensityPreset,
  SmcSmartVisibilityPresetPref,
  SmcVisibilityModePref,
} from '../persistence/types'

const DENSITY_OPTIONS: Array<{ id: SmcDensityPreset; label: string }> = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'structure', label: 'Structure' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'full-debug', label: 'Full Debug' },
]

const VISIBILITY_OPTIONS: Array<{ id: SmcVisibilityModePref; label: string }> = [
  { id: 'focus', label: 'Focus' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'debug', label: 'Debug' },
]

const SMART_VISIBILITY_OPTIONS: Array<{
  id: SmcSmartVisibilityPresetPref
  label: string
}> = [
  { id: 'active-only', label: 'Active Only' },
  { id: 'setup-focus', label: 'Setup Focus' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'history', label: 'History' },
  { id: 'debug', label: 'Debug' },
]

const selectClassName =
  'min-h-11 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm text-foreground'

export interface SmcQuickViewControlsProps {
  densityPreset: SmcDensityPreset
  visibilityMode: SmcVisibilityModePref
  smartVisibilityPreset: SmcSmartVisibilityPresetPref
  onDensityPresetChange: (preset: SmcDensityPreset) => void
  onVisibilityModeChange: (mode: SmcVisibilityModePref) => void
  onSmartVisibilityPresetChange: (preset: SmcSmartVisibilityPresetPref) => void
  className?: string
}

/** Compact native selects for density + visibility quick controls. */
export function SmcQuickViewControls({
  densityPreset,
  visibilityMode,
  smartVisibilityPreset,
  onDensityPresetChange,
  onVisibilityModeChange,
  onSmartVisibilityPresetChange,
  className,
}: SmcQuickViewControlsProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-3', className)}>
      <label className="block min-w-0 space-y-1 text-[11px]">
        <span className="text-muted-foreground">Density</span>
        <select
          className={selectClassName}
          value={densityPreset}
          onChange={(event) =>
            onDensityPresetChange(event.target.value as SmcDensityPreset)
          }
        >
          {DENSITY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block min-w-0 space-y-1 text-[11px]">
        <span className="text-muted-foreground">Intelligence visibility</span>
        <select
          className={selectClassName}
          value={visibilityMode}
          onChange={(event) =>
            onVisibilityModeChange(event.target.value as SmcVisibilityModePref)
          }
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block min-w-0 space-y-1 text-[11px]">
        <span className="text-muted-foreground">Smart chart visibility</span>
        <select
          className={selectClassName}
          value={smartVisibilityPreset}
          onChange={(event) =>
            onSmartVisibilityPresetChange(
              event.target.value as SmcSmartVisibilityPresetPref,
            )
          }
        >
          {SMART_VISIBILITY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
