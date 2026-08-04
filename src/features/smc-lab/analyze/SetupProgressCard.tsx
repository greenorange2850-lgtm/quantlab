import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import type { QmlPattern, SmcQmlLayer } from '@/core/smc'
import type { TradingSetup } from '@/core/setup'
import {
  humanQmlStatus,
  humanSetupProgress,
  humanSetupType,
  pickProgressPattern,
} from './trader-language'

interface SetupProgressCardProps {
  setup: TradingSetup | null
  qml: SmcQmlLayer | null | undefined
  onSelectQml?: (pattern: QmlPattern) => void
  qmlEnabled?: boolean
}

export function SetupProgressCard({
  setup,
  qml,
  onSelectQml,
  qmlEnabled = true,
}: SetupProgressCardProps) {
  const pattern = pickProgressPattern(qml?.patterns ?? [], setup)
  const fromSetup = humanSetupProgress(setup)
  const fromQml = pattern ? humanQmlStatus(pattern.status) : null

  // Prefer setup-engine progress; fall back to QML pattern language when setup is QML-typed.
  const useQmlCopy =
    Boolean(fromQml) &&
    (setup == null ||
      setup.setupType === 'BULLISH_QML' ||
      setup.setupType === 'BEARISH_QML')
  const title = useQmlCopy && fromQml ? fromQml.title : fromSetup.title
  const explanation = useQmlCopy && fromQml ? fromQml.explanation : fromSetup.explanation

  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Setup Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!qmlEnabled && !setup ? (
          <p className="text-muted-foreground">
            No active setup yet. Enable reversal-level detection under Configure if needed.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold tracking-tight">{title}</p>
              {setup ? (
                <Badge variant="outline">{humanSetupType(setup.setupType)}</Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground">{explanation}</p>
            {pattern && onSelectQml ? (
              <button
                type="button"
                className="text-[11px] text-sky-300 underline-offset-2 hover:underline"
                onClick={() => onSelectQml(pattern)}
              >
                Focus entry zone on chart
              </button>
            ) : null}
          </>
        )}

        <Disclosure title="Show technical details" variant="plain">
          <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
            <p>Setup status: {setup?.status ?? '—'}</p>
            <p>Setup id: {setup?.id ?? '—'}</p>
            <p>QML enabled: {String(Boolean(qml?.enabled ?? qmlEnabled))}</p>
            <p>QML status: {pattern?.status ?? '—'}</p>
            <p>QML id: {pattern?.id ?? '—'}</p>
            <p>QML strength: {pattern?.setupStrength ?? '—'}</p>
            {qml?.diagnostics ? (
              <p>
                candidates {qml.diagnostics.structuralCandidates} · ready{' '}
                {qml.diagnostics.entryReady} · invalid {qml.diagnostics.invalidated}
              </p>
            ) : null}
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  )
}
