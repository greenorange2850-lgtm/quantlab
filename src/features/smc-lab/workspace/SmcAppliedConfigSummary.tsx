import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  SmcDensityPreset,
  SmcSmartVisibilityPresetPref,
  SmcVisibilityModePref,
} from '../persistence/types'

const DENSITY_LABELS: Record<SmcDensityPreset, string> = {
  minimal: 'Minimal',
  structure: 'Structure',
  liquidity: 'Liquidity',
  'full-debug': 'Full Debug',
}

const VISIBILITY_LABELS: Record<SmcVisibilityModePref, string> = {
  focus: 'Focus',
  balanced: 'Balanced',
  debug: 'Debug',
}

const SMART_VISIBILITY_LABELS: Record<SmcSmartVisibilityPresetPref, string> = {
  'active-only': 'Active Only',
  'setup-focus': 'Setup Focus',
  balanced: 'Balanced',
  history: 'History',
  debug: 'Debug',
}

export interface SmcAppliedConfigSummaryProps {
  profileId: string
  profileName?: string
  densityPreset: SmcDensityPreset
  visibilityMode: SmcVisibilityModePref
  smartVisibilityPreset: SmcSmartVisibilityPresetPref
  className?: string
}

/** Compact read-only summary of the applied detection / view config. */
export function SmcAppliedConfigSummary({
  profileId,
  profileName,
  densityPreset,
  visibilityMode,
  smartVisibilityPreset,
  className,
}: SmcAppliedConfigSummaryProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Profile', value: profileName?.trim() || profileId },
    { label: 'Density', value: DENSITY_LABELS[densityPreset] },
    { label: 'Intelligence visibility', value: VISIBILITY_LABELS[visibilityMode] },
    {
      label: 'Smart chart visibility',
      value: SMART_VISIBILITY_LABELS[smartVisibilityPreset],
    },
  ]

  return (
    <Card hover={false} className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Applied config</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {row.label}
            </p>
            <p className="truncate text-sm text-foreground">{row.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
