import { describe, expect, it } from 'vitest'
import {
  resolveOptimizerSessionId,
  shouldAwaitDashboardSessionHydrate,
  shouldAwaitResearchArchive,
} from '@/research/ui-gates'

describe('research archive UI gates', () => {
  it('awaits skeleton before archive hydrate completes', () => {
    expect(
      shouldAwaitResearchArchive({
        archiveReady: false,
        hasData: false,
        isPending: false,
      }),
    ).toBe(true)

    expect(
      shouldAwaitResearchArchive({
        archiveReady: true,
        hasData: false,
        isPending: true,
      }),
    ).toBe(true)

    expect(
      shouldAwaitResearchArchive({
        archiveReady: true,
        hasData: false,
        isPending: false,
      }),
    ).toBe(false)

    expect(
      shouldAwaitResearchArchive({
        archiveReady: true,
        hasData: true,
        isPending: false,
      }),
    ).toBe(false)
  })
})

describe('dashboard session hydrate UI gate', () => {
  it('suppresses empty state before startup hydrate attempt', () => {
    expect(
      shouldAwaitDashboardSessionHydrate({
        hasBacktest: false,
        hasAttemptedSessionHydrate: false,
        isHydratingSession: false,
        sessionHydrateError: null,
      }),
    ).toBe(true)

    expect(
      shouldAwaitDashboardSessionHydrate({
        hasBacktest: false,
        hasAttemptedSessionHydrate: true,
        isHydratingSession: true,
        sessionHydrateError: null,
      }),
    ).toBe(true)

    expect(
      shouldAwaitDashboardSessionHydrate({
        hasBacktest: false,
        hasAttemptedSessionHydrate: true,
        isHydratingSession: false,
        sessionHydrateError: null,
      }),
    ).toBe(false)

    expect(
      shouldAwaitDashboardSessionHydrate({
        hasBacktest: true,
        hasAttemptedSessionHydrate: false,
        isHydratingSession: false,
        sessionHydrateError: null,
      }),
    ).toBe(false)
  })
})

describe('optimizer session query param', () => {
  it('prefers session and falls back to analysis', () => {
    expect(
      resolveOptimizerSessionId({
        get: (key) => (key === 'session' ? 'rs-new' : key === 'analysis' ? 'rs-old' : null),
      }),
    ).toBe('rs-new')

    expect(
      resolveOptimizerSessionId({
        get: (key) => (key === 'analysis' ? 'rs-legacy' : null),
      }),
    ).toBe('rs-legacy')

    expect(resolveOptimizerSessionId({ get: () => null })).toBeNull()
  })
})
