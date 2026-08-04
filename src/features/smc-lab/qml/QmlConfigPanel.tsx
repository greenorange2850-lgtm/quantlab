import type { QmlConfig, SmcDetectorConfig } from '@/core/smc'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface QmlConfigPanelProps {
  config: SmcDetectorConfig
  onChangeConfig: (next: SmcDetectorConfig) => void
}

function patchQml(config: SmcDetectorConfig, partial: Partial<QmlConfig>): SmcDetectorConfig {
  return { ...config, qml: { ...config.qml, ...partial } }
}

export function QmlConfigPanel({ config, onChangeConfig }: QmlConfigPanelProps) {
  const qml = config.qml

  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm">Quasimodo Level (QML)</CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Experimental
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-[11px]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={qml.enabled}
            onChange={(e) =>
              onChangeConfig(patchQml(config, { enabled: e.target.checked, experimental: true }))
            }
          />
          <span>Enable QML experimental module</span>
        </label>
        <p className="text-muted-foreground">
          Disabled by default. Does not execute trades. Isolated from Strategy / Backtest /
          Optimizer.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-muted-foreground">Zone mode</span>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1"
              value={qml.zoneMode}
              onChange={(e) =>
                onChangeConfig(
                  patchQml(config, { zoneMode: e.target.value as QmlConfig['zoneMode'] }),
                )
              }
            >
              <option value="OPEN_TO_EXTREME">OPEN_TO_EXTREME (default)</option>
              <option value="STRUCTURE_LEVEL">STRUCTURE_LEVEL</option>
              <option value="FULL_CANDLE">FULL_CANDLE</option>
              <option value="BODY">BODY</option>
              <option value="LINKED_ORDER_BLOCK">LINKED_ORDER_BLOCK</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground">Retest mode</span>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1"
              value={qml.retestMode}
              onChange={(e) =>
                onChangeConfig(
                  patchQml(config, { retestMode: e.target.value as QmlConfig['retestMode'] }),
                )
              }
            >
              <option value="TOUCH">TOUCH (default)</option>
              <option value="MIDPOINT">MIDPOINT</option>
              <option value="DEEP_RETRACE">DEEP_RETRACE</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground">Confirmation mode</span>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1"
              value={qml.confirmationMode}
              onChange={(e) =>
                onChangeConfig(
                  patchQml(config, {
                    confirmationMode: e.target.value as QmlConfig['confirmationMode'],
                  }),
                )
              }
            >
              <option value="BALANCED">BALANCED (default)</option>
              <option value="STRICT">STRICT</option>
              <option value="EARLY">EARLY (experimental)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground">Invalidation mode</span>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1"
              value={qml.invalidationMode}
              onChange={(e) =>
                onChangeConfig(
                  patchQml(config, {
                    invalidationMode: e.target.value as QmlConfig['invalidationMode'],
                  }),
                )
              }
            >
              <option value="CLOSE_BEYOND_ZONE">CLOSE_BEYOND_ZONE (default)</option>
              <option value="WICK_BEYOND_EXTREME">WICK_BEYOND_EXTREME</option>
              <option value="OPPOSING_EXTERNAL_BOS">OPPOSING_EXTERNAL_BOS</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground">Expiration candles (0 = off)</span>
            <Input
              type="number"
              min={0}
              max={500}
              value={qml.expirationCandles}
              onChange={(e) =>
                onChangeConfig(
                  patchQml(config, {
                    expirationCandles: Number(e.target.value) || 0,
                  }),
                )
              }
            />
          </label>

          <label className="space-y-1">
            <span className="text-muted-foreground">Structure scope</span>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1"
              value={qml.structureScope}
              onChange={(e) =>
                onChangeConfig(
                  patchQml(config, {
                    structureScope: e.target.value as QmlConfig['structureScope'],
                  }),
                )
              }
            >
              <option value="BOTH">BOTH</option>
              <option value="EXTERNAL">EXTERNAL</option>
              <option value="INTERNAL">INTERNAL</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={qml.preferLinkedOrderBlock}
            onChange={(e) =>
              onChangeConfig(patchQml(config, { preferLinkedOrderBlock: e.target.checked }))
            }
          />
          <span>Prefer linked Order Block when overlapping</span>
        </label>
      </CardContent>
    </Card>
  )
}
