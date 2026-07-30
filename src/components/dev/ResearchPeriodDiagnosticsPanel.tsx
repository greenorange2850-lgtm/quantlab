import { useEffect, useMemo, useState } from 'react'
import {
  getPeriodFetchSnapshot,
  getPeriodUiSnapshot,
  shouldShowPeriodDiagnostics,
  spansLookLikeLimitOnly1000x15m,
  type PeriodUiSnapshot,
} from '@/research/period-diagnostics'

interface ResearchPeriodDiagnosticsPanelProps {
  /** Live UI snapshot from Optimizer / Analysis (merged into panel). */
  live?: Partial<PeriodUiSnapshot> | null
}

/**
 * Temporary DEV / ?periodDiag=1 panel. Investigation only — remove after root cause confirmed.
 */
export function ResearchPeriodDiagnosticsPanel({ live }: ResearchPeriodDiagnosticsPanelProps) {
  const visible = useMemo(() => {
    if (typeof window === 'undefined') return false
    return shouldShowPeriodDiagnostics({
      isDev: import.meta.env.DEV,
      search: window.location.search,
    })
  }, [])

  const [open, setOpen] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!visible || !live) return
    // Side-effect logging only; parent already records via recordPeriodUiSnapshot when needed.
  }, [visible, live, tick])

  if (!visible || !open) return null

  const fetchSnap = getPeriodFetchSnapshot()
  const uiSnap = getPeriodUiSnapshot()
  const preset = live?.preset ?? uiSnap?.preset ?? null
  const resolvedStart = live?.resolvedStartMs ?? uiSnap?.resolvedStartMs ?? null
  const resolvedEnd = live?.resolvedEndMs ?? uiSnap?.resolvedEndMs ?? null
  const loaded = live?.loadedCandleCount ?? uiSnap?.loadedCandleCount ?? fetchSnap?.candleCountAfterClip
  const datasetStart = live?.datasetStartMs ?? uiSnap?.datasetStartMs ?? fetchSnap?.datasetStartMs
  const datasetEnd = live?.datasetEndMs ?? uiSnap?.datasetEndMs ?? fetchSnap?.datasetEndMs
  const sessionId = live?.sessionId ?? uiSnap?.sessionId ?? null
  const displayedSessionId = live?.displayedSessionId ?? uiSnap?.displayedSessionId ?? null

  const datasetLabel =
    datasetStart != null && datasetEnd != null
      ? `${new Date(datasetStart).toISOString()} → ${new Date(datasetEnd).toISOString()}`
      : '—'
  const resolvedLabel =
    resolvedStart != null && resolvedEnd != null
      ? `${new Date(resolvedStart).toISOString()} → ${new Date(resolvedEnd).toISOString()}`
      : '—'

  const fingerprint =
    datasetStart != null &&
    datasetEnd != null &&
    spansLookLikeLimitOnly1000x15m(datasetStart, datasetEnd)

  return (
    <aside
      className="fixed bottom-3 left-3 z-[60] max-w-[min(100vw-1.5rem,26rem)] rounded-lg border border-accent/40 bg-card-solid/95 p-3 text-[11px] shadow-xl backdrop-blur-md"
      data-testid="period-diag-panel"
      data-refresh={tick}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold tracking-tight text-accent">Period diagnostics</p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-white/5"
            onClick={() => setTick((value) => value + 1)}
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-white/5"
            onClick={() => setOpen(false)}
            aria-label="Dismiss period diagnostics"
          >
            Dismiss
          </button>
        </div>
      </div>

      <dl className="space-y-1.5 text-muted-foreground">
        <div>
          <dt>Research period preset:</dt>
          <dd className="font-mono text-foreground">{preset ?? '—'}</dd>
        </div>
        <div>
          <dt>Resolved range:</dt>
          <dd className="break-all font-mono text-foreground">{resolvedLabel}</dd>
        </div>
        <div>
          <dt>Loaded candles:</dt>
          <dd className="font-mono text-foreground">{loaded ?? '—'}</dd>
        </div>
        <div>
          <dt>Dataset range:</dt>
          <dd className="break-all font-mono text-foreground">{datasetLabel}</dd>
        </div>
        <div>
          <dt>Session id:</dt>
          <dd className="break-all font-mono text-foreground">{sessionId ?? '—'}</dd>
        </div>
        <div>
          <dt>Displayed session id:</dt>
          <dd className="break-all font-mono text-foreground">{displayedSessionId ?? '—'}</dd>
        </div>
        <div>
          <dt>Fetch mode:</dt>
          <dd className="font-mono text-foreground">{fetchSnap?.mode ?? '—'}</dd>
        </div>
        <div>
          <dt>Pagination requests:</dt>
          <dd className="font-mono text-foreground">{fetchSnap?.paginationRequests ?? '—'}</dd>
        </div>
        <div>
          <dt>Provider received start/end:</dt>
          <dd className="break-all font-mono text-foreground">
            {fetchSnap
              ? `${fetchSnap.received.startTime ?? 'null'} → ${fetchSnap.received.endTime ?? 'null'}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Before clip / after clip:</dt>
          <dd className="font-mono text-foreground">
            {fetchSnap
              ? `${fetchSnap.candleCountBeforeClip} / ${fetchSnap.candleCountAfterClip}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Config start/end (session):</dt>
          <dd className="break-all font-mono text-foreground">
            {live?.configStartMs != null && live?.configEndMs != null
              ? `${new Date(live.configStartMs).toISOString()} → ${new Date(live.configEndMs).toISOString()}`
              : uiSnap?.configStartMs != null && uiSnap?.configEndMs != null
                ? `${new Date(uiSnap.configStartMs).toISOString()} → ${new Date(uiSnap.configEndMs).toISOString()}`
                : '— (missing — Analysis falls back to equity-curve endpoints)'}
          </dd>
        </div>
        <div>
          <dt>Analysis trades:</dt>
          <dd className="font-mono text-foreground">
            {live?.analysisTradeCount ?? uiSnap?.analysisTradeCount ?? '—'}
          </dd>
        </div>
      </dl>

      {fingerprint ? (
        <p className="mt-2 text-pretty text-warning">
          Dataset span looks like legacy limit-only 1000×15m (~10 days), not Last 30 days (~2880
          candles / ~30 days).
        </p>
      ) : null}
    </aside>
  )
}
