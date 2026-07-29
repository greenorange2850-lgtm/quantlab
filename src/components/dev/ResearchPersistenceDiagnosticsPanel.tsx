import { useEffect, useMemo, useState } from 'react'
import {
  ensureResearchSessionArchiveHydrated,
  getResearchSessionPersistenceDiagnostics,
} from '@/research/session-archive'
import {
  classifyVercelHost,
  shouldShowPersistenceDiagnostics,
  STABLE_VERCEL_PRODUCTION_URL,
} from '@/research/persistence-diagnostics'

/**
 * Temporary preview/dev panel for researching localStorage origin isolation.
 * Does not mutate storage. Hidden in non-Vercel production-like hosts unless
 * `?persistDiag=1` is present.
 */
export function ResearchPersistenceDiagnosticsPanel() {
  const visible = useMemo(() => {
    if (typeof window === 'undefined') return false
    return shouldShowPersistenceDiagnostics({
      isDev: import.meta.env.DEV,
      hostname: window.location.hostname,
      search: window.location.search,
    })
  }, [])

  const [open, setOpen] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!visible) return
    ensureResearchSessionArchiveHydrated()
    const snapshot = getResearchSessionPersistenceDiagnostics()
    const host = window.location.hostname
    const classification = classifyVercelHost(host)
    // Temporary console diagnostics for Vercel-only testing.
    console.info('[quantlab:persist-diag]', {
      origin: window.location.origin,
      hostname: host,
      hostKind: classification.kind,
      storageKey: snapshot.storageKey,
      hydrated: snapshot.hydrated,
      persistedCount: snapshot.persistedCount,
      memoryCount: snapshot.memoryCount,
      payloadBytes: snapshot.payloadBytes,
      keyPresent: snapshot.keyPresent,
      lastPersistenceError: snapshot.lastPersistenceError,
      stableUrl: STABLE_VERCEL_PRODUCTION_URL,
      warning: classification.warning,
    })
  }, [visible])

  if (!visible || !open) return null

  ensureResearchSessionArchiveHydrated()
  const diag = getResearchSessionPersistenceDiagnostics()
  const origin = typeof window !== 'undefined' ? window.location.origin : '—'
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '—'
  const classification = classifyVercelHost(hostname)

  return (
    <aside
      className="fixed bottom-3 right-3 z-[60] max-w-[min(100vw-1.5rem,22rem)] rounded-lg border border-warning/40 bg-card-solid/95 p-3 text-[11px] shadow-xl backdrop-blur-md"
      data-testid="persist-diag-panel"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold tracking-tight text-warning">Persist diagnostics</p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            onClick={() => setTick((value) => value + 1)}
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="Dismiss persistence diagnostics"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* tick forces a re-read after Refresh */}
      <dl className="space-y-1 text-muted-foreground" data-refresh={tick}>
        <div className="flex justify-between gap-3">
          <dt>origin</dt>
          <dd className="max-w-[14rem] break-all text-right font-mono text-foreground">
            {origin}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>host kind</dt>
          <dd className="font-mono text-foreground">{classification.kind}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>key</dt>
          <dd className="font-mono text-foreground">{diag.storageKey}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>hydrated</dt>
          <dd className="font-mono text-foreground">{String(diag.hydrated)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>persisted count</dt>
          <dd className="font-mono text-foreground">{diag.persistedCount}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>memory count</dt>
          <dd className="font-mono text-foreground">{diag.memoryCount}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>payload bytes</dt>
          <dd className="font-mono text-foreground">
            {diag.payloadBytes === null ? 'n/a' : diag.payloadBytes}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>key present</dt>
          <dd className="font-mono text-foreground">{String(diag.keyPresent)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>last error</dt>
          <dd className="max-w-[14rem] break-all text-right font-mono text-foreground">
            {diag.lastPersistenceError ?? 'none'}
          </dd>
        </div>
      </dl>

      {classification.warning ? (
        <p className="mt-2 text-pretty text-warning">{classification.warning}</p>
      ) : null}

      <p className="mt-2 text-pretty text-muted-foreground">
        Test persistence on the stable URL:{' '}
        <a
          className="font-mono text-foreground underline underline-offset-2"
          href={STABLE_VERCEL_PRODUCTION_URL}
          target="_blank"
          rel="noreferrer"
        >
          {STABLE_VERCEL_PRODUCTION_URL}
        </a>
      </p>
    </aside>
  )
}
