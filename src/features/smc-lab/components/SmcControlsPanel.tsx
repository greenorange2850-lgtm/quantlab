import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SMC_CONFIG_BOUNDS,
  listActiveSmcModules,
  listPlannedSmcModules,
  type SmcDetectorConfig,
} from '@/core/smc'
import { listSmcSavedConfigs } from '../persistence/prefs-archive'
import type { SmcSavedLabConfig } from '../persistence/types'
import type { SmcChartLayerToggles } from './SmcCandlestickChart'

interface SmcControlsPanelProps {
  config: SmcDetectorConfig
  layers: SmcChartLayerToggles
  detecting: boolean
  detectionProgress: number | null
  onChangeConfig: (next: SmcDetectorConfig) => void
  onChangeLayers: (next: SmcChartLayerToggles) => void
  onResetDefaults: () => void
  onApply: () => void
  onClearMarkers: () => void
  onLoadSavedConfig: (config: SmcSavedLabConfig) => void
  compareConfigId: string | null
  onCompareConfigId: (id: string | null) => void
}

export function SmcControlsPanel({
  config,
  layers,
  detecting,
  detectionProgress,
  onChangeConfig,
  onChangeLayers,
  onResetDefaults,
  onApply,
  onClearMarkers,
  onLoadSavedConfig,
  compareConfigId,
  onCompareConfigId,
}: SmcControlsPanelProps) {
  const saved = listSmcSavedConfigs()
  const activeModules = listActiveSmcModules()
  const planned = listPlannedSmcModules()

  const patchSwing = (partial: Partial<SmcDetectorConfig['swing']>) =>
    onChangeConfig({ ...config, swing: { ...config.swing, ...partial } })
  const patchBos = (partial: Partial<SmcDetectorConfig['bos']>) =>
    onChangeConfig({ ...config, bos: { ...config.bos, ...partial } })

  return (
    <div className="space-y-4">
      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detectors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeModules.map((module) => {
            const enabled =
              module.configKey === 'swing' ? config.swing.enabled : config.bos.enabled
            return (
              <label key={module.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={enabled}
                  onChange={(e) => {
                    if (module.configKey === 'swing') patchSwing({ enabled: e.target.checked })
                    if (module.configKey === 'bos') patchBos({ enabled: e.target.checked })
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
                </span>
              </label>
            )
          })}

          <div className="rounded-lg border border-dashed border-border/70 p-2">
            <p className="text-[11px] font-medium text-muted-foreground">Available later</p>
            <ul className="mt-1 space-y-1">
              {planned.map((module) => (
                <li
                  key={module.id}
                  className="pointer-events-none select-none text-[11px] text-muted-foreground/70"
                  aria-disabled="true"
                >
                  {module.name}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Swing settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-[11px]">
            <span className="text-muted-foreground">Pivot Left</span>
            <Input
              type="number"
              min={SMC_CONFIG_BOUNDS.pivotMin}
              max={SMC_CONFIG_BOUNDS.pivotMax}
              value={config.swing.pivotLeft}
              onChange={(e) => patchSwing({ pivotLeft: Number(e.target.value) })}
              className="bg-white/[0.03]"
            />
          </label>
          <label className="space-y-1 text-[11px]">
            <span className="text-muted-foreground">Pivot Right</span>
            <Input
              type="number"
              min={SMC_CONFIG_BOUNDS.pivotMin}
              max={SMC_CONFIG_BOUNDS.pivotMax}
              value={config.swing.pivotRight}
              onChange={(e) => patchSwing({ pivotRight: Number(e.target.value) })}
              className="bg-white/[0.03]"
            />
          </label>
          <label className="space-y-1 text-[11px]">
            <span className="text-muted-foreground">Equal Tolerance %</span>
            <Input
              type="number"
              step="0.01"
              min={SMC_CONFIG_BOUNDS.toleranceMin}
              max={SMC_CONFIG_BOUNDS.toleranceMax}
              value={config.swing.equalTolerancePercent}
              onChange={(e) => patchSwing({ equalTolerancePercent: Number(e.target.value) })}
              className="bg-white/[0.03]"
            />
          </label>
        </CardContent>
      </Card>

      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">BOS settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Break Confirmation: <span className="font-medium text-foreground">Candle Close</span>
          </p>
          <label className="block space-y-1 text-[11px]">
            <span className="text-muted-foreground">Minimum Break %</span>
            <Input
              type="number"
              step="0.01"
              min={SMC_CONFIG_BOUNDS.breakPctMin}
              max={SMC_CONFIG_BOUNDS.breakPctMax}
              value={config.bos.minimumBreakPercent}
              onChange={(e) => patchBos({ minimumBreakPercent: Number(e.target.value) })}
              className="bg-white/[0.03]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.bos.requireLatestConfirmedSwing}
              onChange={(e) => patchBos({ requireLatestConfirmedSwing: e.target.checked })}
            />
            Latest Confirmed Swing Only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.bos.allowRepeatedBreaksOfSameSwing}
              onChange={(e) => patchBos({ allowRepeatedBreaksOfSameSwing: e.target.checked })}
            />
            Repeated Breaks of Same Swing
          </label>
        </CardContent>
      </Card>

      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Chart layers</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ['swings', 'Swings'],
              ['bosLabels', 'BOS labels'],
              ['bosLines', 'BOS connector lines'],
              ['manualMarks', 'Manual marks'],
              ['validationMarks', 'Validation marks'],
            ] as const
          ).map(([key, label]) => (
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
              </Button>
              <Button
                type="button"
                variant={compareConfigId === entry.id ? 'secondary' : 'ghost'}
                size="sm"
                className="min-h-9"
                onClick={() =>
                  onCompareConfigId(compareConfigId === entry.id ? null : entry.id)
                }
              >
                Compare
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

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
  )
}
