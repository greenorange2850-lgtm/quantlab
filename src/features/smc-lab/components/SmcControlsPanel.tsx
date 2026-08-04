import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import {
  SMC_CONFIG_BOUNDS,
  listActiveSmcModules,
  listBuiltinSmcPresets,
  listBuiltinSmcProfiles,
  moduleDependencyReason,
  type SmcDetectionProfile,
  type SmcDetectorConfig,
  type SmcModuleConfigKey,
} from '@/core/smc'
import {
  deleteSmcNamedConfig,
  listSmcSavedConfigs,
  layersForDensityPreset,
} from '../persistence/prefs-archive'
import type { SmcDensityPreset, SmcSavedLabConfig } from '../persistence/types'
import type { SmcChartLayerToggles } from './SmcCandlestickChart'

export type SmcControlsSection =
  | 'profile'
  | 'modules'
  | 'density'
  | 'layers'
  | 'advanced'
  | 'presets'
  | 'saved'
  | 'actions'

const ALL_SECTIONS: SmcControlsSection[] = [
  'profile',
  'modules',
  'density',
  'layers',
  'advanced',
  'presets',
  'saved',
  'actions',
]

const LAYER_LABELS: Array<[keyof SmcChartLayerToggles, string]> = [
  ['externalSwings', 'External swings (eSH/eSL)'],
  ['internalSwings', 'Internal swings (iSH/iSL)'],
  ['bosLabels', 'BOS labels'],
  ['chochLabels', 'CHoCH labels'],
  ['internalBreaks', 'Internal BOS/CHoCH'],
  ['bosLines', 'BOS connector lines'],
  ['activeFvg', 'Active FVG zones'],
  ['mitigatedFvg', 'Mitigated FVG'],
  ['activeOrderBlocks', 'Active Order Blocks'],
  ['invalidatedOrderBlocks', 'Invalidated Order Blocks'],
  ['equalLevels', 'Equal highs / lows'],
  ['liquiditySweeps', 'Liquidity sweeps'],
  ['displacement', 'Displacement'],
  ['manualMarks', 'Manual marks'],
  ['validationMarks', 'Validation marks'],
  ['connectorLines', 'Connector lines'],
  ['diagnosticsLabels', 'Diagnostics labels'],
]

const DENSITY_OPTIONS: Array<{ id: SmcDensityPreset; label: string }> = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'structure', label: 'Structure' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'full-debug', label: 'Full Debug' },
]

interface SmcControlsPanelProps {
  config: SmcDetectorConfig
  layers: SmcChartLayerToggles
  densityPreset: SmcDensityPreset
  activeProfileId: string
  detecting: boolean
  detectionProgress: number | null
  moduleProgress?: Array<{ module: string; status: string }> | null
  onChangeConfig: (next: SmcDetectorConfig) => void
  onChangeLayers: (next: SmcChartLayerToggles) => void
  onChangeDensityPreset: (preset: SmcDensityPreset) => void
  onChangeProfileId: (profileId: string) => void
  onApplyProfile: (profile: SmcDetectionProfile) => void
  onResetDefaults: () => void
  onApply: () => void
  onClearMarkers: () => void
  onLoadSavedConfig: (config: SmcSavedLabConfig) => void
  onDeleteSavedConfig?: (id: string) => void
  compareProfileId: string | null
  onCompareProfileId: (id: string | null) => void
  /** Limit which sections render (for page layout composition). */
  sections?: SmcControlsSection[]
}

function patchSection<K extends SmcModuleConfigKey>(
  config: SmcDetectorConfig,
  key: K,
  partial: Partial<SmcDetectorConfig[K]>,
): SmcDetectorConfig {
  return { ...config, [key]: { ...config[key], ...partial } }
}

function moduleEnabled(config: SmcDetectorConfig, key: SmcModuleConfigKey): boolean {
  return Boolean(config[key].enabled)
}

export function SmcControlsPanel({
  config,
  layers,
  densityPreset,
  activeProfileId,
  detecting,
  detectionProgress,
  moduleProgress = null,
  onChangeConfig,
  onChangeLayers,
  onChangeDensityPreset,
  onChangeProfileId,
  onApplyProfile,
  onResetDefaults,
  onApply,
  onClearMarkers,
  onLoadSavedConfig,
  onDeleteSavedConfig,
  compareProfileId,
  onCompareProfileId,
  sections = ALL_SECTIONS,
}: SmcControlsPanelProps) {
  const show = (section: SmcControlsSection) => sections.includes(section)
  const profiles = listBuiltinSmcProfiles()
  const presets = listBuiltinSmcPresets()
  const saved = listSmcSavedConfigs()
  const activeModules = listActiveSmcModules()
  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null

  return (
    <div className="space-y-4">
      {show('profile') ? (
        <Card hover={false}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detection profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block space-y-1 text-[11px]">
              <span className="text-muted-foreground">Profile</span>
              <select
                className="h-11 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
                value={activeProfileId}
                onChange={(e) => {
                  const id = e.target.value
                  onChangeProfileId(id)
                  const profile = profiles.find((p) => p.id === id)
                  if (profile && id !== 'custom') onApplyProfile(profile)
                }}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            {activeProfile ? (
              <div className="space-y-2 rounded-lg border border-border/60 bg-white/[0.02] p-3 text-[11px]">
                <p className="text-pretty text-muted-foreground">{activeProfile.description}</p>
                <div>
                  <p className="font-medium">Assumptions</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {activeProfile.assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Limitations</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {activeProfile.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                {activeProfile.sourceNotes?.length ? (
                  <div>
                    <p className="font-medium">Source notes</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {activeProfile.sourceNotes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={compareProfileId != null}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        onCompareProfileId(null)
                        return
                      }
                      const other =
                        profiles.find((p) => p.id !== activeProfileId)?.id ?? 'ict-inspired'
                      onCompareProfileId(other)
                    }}
                  />
                  Compare with another profile (aggregate counts)
                </label>
                {compareProfileId != null ? (
                  <label className="block space-y-1 text-[11px]">
                    <span className="text-muted-foreground">Compare profile B</span>
                    <select
                      className="h-10 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
                      value={compareProfileId}
                      onChange={(e) => onCompareProfileId(e.target.value)}
                    >
                      {profiles
                        .filter((p) => p.id !== activeProfileId)
                        .map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {show('modules') ? (
        <Card hover={false}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeModules.map((module) => {
              if (!module.configKey) return null
              const enabled = moduleEnabled(config, module.configKey)
              const depReason = moduleDependencyReason(module.id, config)
              const blocked = Boolean(depReason)
              return (
                <label key={module.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={enabled}
                    disabled={blocked && !enabled}
                    onChange={(e) => {
                      onChangeConfig(
                        patchSection(config, module.configKey!, { enabled: e.target.checked }),
                      )
                    }}
                  />
                  <span>
                    <span className="font-medium">{module.name}</span>
                    <Badge variant="accent" className="ml-2 text-[9px]">
                      Active
                    </Badge>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {module.description}
                    </span>
                    {depReason ? (
                      <span className="mt-0.5 block text-[11px] text-amber-300">
                        {depReason}
                      </span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      {show('density') ? (
        <Card hover={false}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Density preset</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {DENSITY_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={densityPreset === option.id ? 'secondary' : 'outline'}
                className="min-h-9"
                onClick={() => {
                  onChangeDensityPreset(option.id)
                  onChangeLayers(layersForDensityPreset(option.id))
                }}
              >
                {option.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {show('layers') ? (
        <Card hover={false}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Chart layers</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {LAYER_LABELS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={(e) => onChangeLayers({ ...layers, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {show('advanced') ? (
        <Disclosure title="Advanced settings" defaultOpen={false}>
          <div className="space-y-4">
            <AdvancedNumberGrid
              title="Swing"
              fields={[
                {
                  label: 'Pivot Left',
                  value: config.swing.pivotLeft,
                  min: SMC_CONFIG_BOUNDS.pivotMin,
                  max: SMC_CONFIG_BOUNDS.pivotMax,
                  onChange: (v) => onChangeConfig(patchSection(config, 'swing', { pivotLeft: v })),
                },
                {
                  label: 'Pivot Right',
                  value: config.swing.pivotRight,
                  min: SMC_CONFIG_BOUNDS.pivotMin,
                  max: SMC_CONFIG_BOUNDS.pivotMax,
                  onChange: (v) => onChangeConfig(patchSection(config, 'swing', { pivotRight: v })),
                },
                {
                  label: 'Equal Tolerance %',
                  value: config.swing.equalTolerancePercent,
                  min: SMC_CONFIG_BOUNDS.toleranceMin,
                  max: SMC_CONFIG_BOUNDS.toleranceMax,
                  step: 0.01,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'swing', { equalTolerancePercent: v })),
                },
              ]}
            />

            <AdvancedNumberGrid
              title="Structure"
              fields={[
                {
                  label: 'Internal Left',
                  value: config.structure.internalPivotLeft,
                  min: SMC_CONFIG_BOUNDS.pivotMin,
                  max: SMC_CONFIG_BOUNDS.pivotMax,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'structure', { internalPivotLeft: v })),
                },
                {
                  label: 'Internal Right',
                  value: config.structure.internalPivotRight,
                  min: SMC_CONFIG_BOUNDS.pivotMin,
                  max: SMC_CONFIG_BOUNDS.pivotMax,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'structure', { internalPivotRight: v })),
                },
                {
                  label: 'External Left',
                  value: config.structure.externalPivotLeft,
                  min: SMC_CONFIG_BOUNDS.pivotMin,
                  max: SMC_CONFIG_BOUNDS.pivotMax,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'structure', { externalPivotLeft: v })),
                },
                {
                  label: 'External Right',
                  value: config.structure.externalPivotRight,
                  min: SMC_CONFIG_BOUNDS.pivotMin,
                  max: SMC_CONFIG_BOUNDS.pivotMax,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'structure', { externalPivotRight: v })),
                },
                {
                  label: 'Min External Prominence %',
                  value: config.structure.minimumExternalProminencePercent,
                  min: 0,
                  max: 5,
                  step: 0.01,
                  onChange: (v) =>
                    onChangeConfig(
                      patchSection(config, 'structure', { minimumExternalProminencePercent: v }),
                    ),
                },
                {
                  label: 'Min External Bars Apart',
                  value: config.structure.minimumExternalBarsApart,
                  min: 1,
                  max: 100,
                  onChange: (v) =>
                    onChangeConfig(
                      patchSection(config, 'structure', { minimumExternalBarsApart: v }),
                    ),
                },
              ]}
            />

            <Card hover={false}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">BOS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  Break Confirmation:{' '}
                  <span className="font-medium text-foreground">Candle Close</span>
                </p>
                <label className="block space-y-1 text-[11px]">
                  <span className="text-muted-foreground">Minimum Break %</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={SMC_CONFIG_BOUNDS.breakPctMin}
                    max={SMC_CONFIG_BOUNDS.breakPctMax}
                    value={config.bos.minimumBreakPercent}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'bos', {
                          minimumBreakPercent: Number(e.target.value),
                        }),
                      )
                    }
                    className="bg-white/[0.03]"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.bos.requireLatestConfirmedSwing}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'bos', {
                          requireLatestConfirmedSwing: e.target.checked,
                        }),
                      )
                    }
                  />
                  Latest Confirmed Swing Only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.bos.allowRepeatedBreaksOfSameSwing}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'bos', {
                          allowRepeatedBreaksOfSameSwing: e.target.checked,
                        }),
                      )
                    }
                  />
                  Repeated Breaks of Same Swing
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.bos.preferExternalSwings}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'bos', { preferExternalSwings: e.target.checked }),
                      )
                    }
                  />
                  Prefer External Swings
                </label>
                <ScopeSelect
                  value={config.bos.structureScope}
                  onChange={(structureScope) =>
                    onChangeConfig(patchSection(config, 'bos', { structureScope }))
                  }
                />
              </CardContent>
            </Card>

            <Card hover={false}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">CHoCH</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="block space-y-1 text-[11px]">
                  <span className="text-muted-foreground">Minimum Break %</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={SMC_CONFIG_BOUNDS.breakPctMin}
                    max={SMC_CONFIG_BOUNDS.breakPctMax}
                    value={config.choch.minimumBreakPercent}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'choch', {
                          minimumBreakPercent: Number(e.target.value),
                        }),
                      )
                    }
                    className="bg-white/[0.03]"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.choch.requireDisplacement}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'choch', { requireDisplacement: e.target.checked }),
                      )
                    }
                  />
                  Require Displacement
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.choch.preferExternalSwings}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'choch', { preferExternalSwings: e.target.checked }),
                      )
                    }
                  />
                  Prefer External Swings
                </label>
                <ScopeSelect
                  value={config.choch.structureScope}
                  onChange={(structureScope) =>
                    onChangeConfig(patchSection(config, 'choch', { structureScope }))
                  }
                />
              </CardContent>
            </Card>

            <AdvancedNumberGrid
              title="Displacement"
              fields={[
                {
                  label: 'ATR Period',
                  value: config.displacement.atrPeriod,
                  min: SMC_CONFIG_BOUNDS.atrMin,
                  max: SMC_CONFIG_BOUNDS.atrMax,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'displacement', { atrPeriod: v })),
                },
                {
                  label: 'Min Body ATR Multiple',
                  value: config.displacement.minimumBodyAtrMultiple,
                  min: 0,
                  max: 10,
                  step: 0.1,
                  onChange: (v) =>
                    onChangeConfig(
                      patchSection(config, 'displacement', { minimumBodyAtrMultiple: v }),
                    ),
                },
                {
                  label: 'Min Body/Range Ratio',
                  value: config.displacement.minimumBodyToRangeRatio,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  onChange: (v) =>
                    onChangeConfig(
                      patchSection(config, 'displacement', { minimumBodyToRangeRatio: v }),
                    ),
                },
                {
                  label: 'Max Opposite Wick Ratio',
                  value: config.displacement.maximumOppositeWickRatio,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  onChange: (v) =>
                    onChangeConfig(
                      patchSection(config, 'displacement', { maximumOppositeWickRatio: v }),
                    ),
                },
              ]}
            />

            <AdvancedNumberGrid
              title="Fair Value Gap"
              fields={[
                {
                  label: 'Min Gap %',
                  value: config.fvg.minimumGapPercent,
                  min: 0,
                  max: 5,
                  step: 0.01,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'fvg', { minimumGapPercent: v })),
                },
                {
                  label: 'Min Gap ATR Multiple',
                  value: config.fvg.minimumGapAtrMultiple,
                  min: 0,
                  max: 10,
                  step: 0.1,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'fvg', { minimumGapAtrMultiple: v })),
                },
                {
                  label: 'ATR Period',
                  value: config.fvg.atrPeriod,
                  min: SMC_CONFIG_BOUNDS.atrMin,
                  max: SMC_CONFIG_BOUNDS.atrMax,
                  onChange: (v) => onChangeConfig(patchSection(config, 'fvg', { atrPeriod: v })),
                },
              ]}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.fvg.requireDisplacementMiddleCandle}
                onChange={(e) =>
                  onChangeConfig(
                    patchSection(config, 'fvg', {
                      requireDisplacementMiddleCandle: e.target.checked,
                    }),
                  )
                }
              />
              Require Displacement Middle Candle
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.fvg.trackMitigation}
                onChange={(e) =>
                  onChangeConfig(
                    patchSection(config, 'fvg', { trackMitigation: e.target.checked }),
                  )
                }
              />
              Track FVG Mitigation
            </label>

            <AdvancedNumberGrid
              title="Equal Levels"
              fields={[
                {
                  label: 'Tolerance %',
                  value: config.equalLevels.tolerancePercent,
                  min: 0,
                  max: 5,
                  step: 0.01,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'equalLevels', { tolerancePercent: v })),
                },
                {
                  label: 'Minimum Touches',
                  value: config.equalLevels.minimumTouches,
                  min: 2,
                  max: 20,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'equalLevels', { minimumTouches: v })),
                },
                {
                  label: 'Min Bars Apart',
                  value: config.equalLevels.minimumBarsApart,
                  min: 1,
                  max: 100,
                  onChange: (v) =>
                    onChangeConfig(patchSection(config, 'equalLevels', { minimumBarsApart: v })),
                },
              ]}
            />

            <AdvancedNumberGrid
              title="Liquidity Sweep"
              fields={[
                {
                  label: 'Min Penetration %',
                  value: config.liquiditySweep.minimumPenetrationPercent,
                  min: 0,
                  max: 5,
                  step: 0.01,
                  onChange: (v) =>
                    onChangeConfig(
                      patchSection(config, 'liquiditySweep', { minimumPenetrationPercent: v }),
                    ),
                },
                {
                  label: 'Max Close Distance %',
                  value: config.liquiditySweep.maximumCloseDistancePercent,
                  min: 0,
                  max: 10,
                  step: 0.01,
                  onChange: (v) =>
                    onChangeConfig(
                      patchSection(config, 'liquiditySweep', {
                        maximumCloseDistancePercent: v,
                      }),
                    ),
                },
                {
                  label: 'Displacement Confirm Bars',
                  value: config.liquiditySweep.displacementConfirmationBars,
                  min: 0,
                  max: 20,
                  onChange: (v) =>
                    onChangeConfig(
                      patchSection(config, 'liquiditySweep', {
                        displacementConfirmationBars: v,
                      }),
                    ),
                },
              ]}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.liquiditySweep.requireSameCandleRejection}
                onChange={(e) =>
                  onChangeConfig(
                    patchSection(config, 'liquiditySweep', {
                      requireSameCandleRejection: e.target.checked,
                    }),
                  )
                }
              />
              Require Same-Candle Rejection
            </label>

            <Card hover={false}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Order Block</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="block space-y-1 text-[11px]">
                  <span className="text-muted-foreground">Search Back Bars</span>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={config.orderBlock.searchBackBars}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'orderBlock', {
                          searchBackBars: Number(e.target.value),
                        }),
                      )
                    }
                    className="bg-white/[0.03]"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.orderBlock.requireDisplacement}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'orderBlock', {
                          requireDisplacement: e.target.checked,
                        }),
                      )
                    }
                  />
                  Require Displacement
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.orderBlock.requireFvg}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'orderBlock', { requireFvg: e.target.checked }),
                      )
                    }
                  />
                  Require FVG
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.orderBlock.trackMitigation}
                    onChange={(e) =>
                      onChangeConfig(
                        patchSection(config, 'orderBlock', {
                          trackMitigation: e.target.checked,
                        }),
                      )
                    }
                  />
                  Track Mitigation
                </label>
              </CardContent>
            </Card>
          </div>
        </Disclosure>
      ) : null}

      {show('presets') ? (
        <Card hover={false}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Presets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{preset.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{preset.description}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  onClick={() => {
                    onChangeConfig(preset.config)
                    onChangeProfileId(String(preset.profileId))
                  }}
                >
                  Apply
                </Button>
                <Button
                  type="button"
                  variant={compareProfileId === preset.profileId ? 'secondary' : 'ghost'}
                  size="sm"
                  className="min-h-9"
                  onClick={() =>
                    onCompareProfileId(
                      compareProfileId === preset.profileId ? null : String(preset.profileId),
                    )
                  }
                >
                  Compare
                </Button>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">Built-in presets cannot be deleted.</p>
          </CardContent>
        </Card>
      ) : null}

      {show('saved') ? (
        <Card hover={false}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Saved Lab configs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {saved.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 flex-1 justify-start"
                  onClick={() => onLoadSavedConfig(entry)}
                >
                  {entry.name}
                  {entry.builtin ? (
                    <Badge variant="outline" className="ml-2 text-[9px]">
                      Built-in
                    </Badge>
                  ) : null}
                </Button>
                {!entry.builtin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-9"
                    onClick={() => {
                      deleteSmcNamedConfig(entry.id)
                      onDeleteSavedConfig?.(entry.id)
                    }}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {show('actions') ? (
        <div className="space-y-2">
          {detecting && moduleProgress?.length ? (
            <ul className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground sm:grid-cols-3">
              {moduleProgress.map((item) => (
                <li key={item.module}>
                  {item.module}: <span className="text-foreground">{item.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="min-h-11 flex-1" disabled={detecting} onClick={onApply}>
              {detecting
                ? `Detecting${detectionProgress != null ? ` ${Math.round(detectionProgress * 100)}%` : '…'}`
                : 'Apply Detection'}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={onResetDefaults}>
              Reset to Defaults
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClearMarkers}>
              Clear Markers
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ScopeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: 'INTERNAL' | 'EXTERNAL' | 'BOTH' | 'BASE') => void
}) {
  return (
    <label className="block space-y-1 text-[11px]">
      <span className="text-muted-foreground">Structure Scope</span>
      <select
        className="h-10 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as 'INTERNAL' | 'EXTERNAL' | 'BOTH' | 'BASE')}
      >
        <option value="BOTH">Both</option>
        <option value="EXTERNAL">External</option>
        <option value="INTERNAL">Internal</option>
        <option value="BASE">Base</option>
      </select>
    </label>
  )
}

function AdvancedNumberGrid({
  title,
  fields,
}: {
  title: string
  fields: Array<{
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    onChange: (value: number) => void
  }>
}) {
  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <label key={field.label} className="space-y-1 text-[11px]">
            <span className="text-muted-foreground">{field.label}</span>
            <Input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={field.value}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className="bg-white/[0.03]"
            />
          </label>
        ))}
      </CardContent>
    </Card>
  )
}
