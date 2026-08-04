import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SignalVerificationSnapshot } from '../signal-verification'

interface SignalVerificationCardProps {
  snapshot: SignalVerificationSnapshot | null
}

function formatNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-mono text-xs text-foreground">{value}</span>
    </div>
  )
}

export function SignalVerificationCard({ snapshot }: SignalVerificationCardProps) {
  if (!snapshot) {
    return (
      <Card>
        <CardContent className="py-5 text-xs text-muted-foreground">
          Signal verification is unavailable for the selected candle.
        </CardContent>
      </Card>
    )
  }

  const signalVariant =
    snapshot.signal === 'BUY' ? 'success' : snapshot.signal === 'SELL' ? 'danger' : 'outline'

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <CardTitle>Signal Verification</CardTitle>
        <Badge variant={signalVariant}>{snapshot.signal}</Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border border-border/60 bg-white/[0.02] px-3">
          <Row label="Candle" value={new Date(snapshot.candleTime).toLocaleString()} />
          <Row label="Fast EMA" value={formatNumber(snapshot.fastEma)} />
          <Row label="Slow EMA" value={formatNumber(snapshot.slowEma)} />
          <Row label="RSI" value={formatNumber(snapshot.rsi)} />
          <Row label="EMA Cross" value={snapshot.cross} />
          <Row label="Raw Signal" value={snapshot.rawSignal} />
          <Row label="Execution" value={snapshot.execution} />
          <Row label="Position Before" value={snapshot.positionBefore} />
          <Row label="RSI Confirmation" value={snapshot.rsiConfirmation} />
          <Row
            label="Stop Sizing"
            value={
              snapshot.stopSizingValid == null
                ? 'Unavailable'
                : snapshot.stopSizingValid
                  ? 'Valid'
                  : 'Invalid'
            }
          />
          <Row
            label="Outcome"
            value={
              snapshot.tradeOpened
                ? 'Trade opened'
                : snapshot.tradeClosed
                  ? 'Trade closed'
                  : snapshot.skipped
                    ? `Skipped: ${snapshot.skipReason ?? 'Unavailable'}`
                    : 'No trade'
            }
          />
        </div>
        <div className="mt-3 rounded-lg border border-border/60 bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason</p>
          <p className="mt-1 text-xs text-foreground">{snapshot.reason || 'Unavailable'}</p>
        </div>
      </CardContent>
    </Card>
  )
}
