/**
 * Mutable run controls for Random Search pause / resume / cancel.
 * Engine polls these between candidates (and after each candidate completes).
 * Does not alter sampling, scoring, or ranking — only scheduling gates.
 */

export type CancelIntent = 'discard' | 'save-partial'

export interface RandomSearchRunControls {
  /** Request pause after the current candidate finishes. */
  requestPause: () => void
  /** Resume from the exact next candidate. */
  resume: () => void
  /** Request cancel after the current candidate (discard or save-partial). */
  requestCancel: (intent: CancelIntent) => void
  /** True when a pause was requested and not yet entered/cleared. */
  isPauseRequested: () => boolean
  /** True while the engine is blocked in the pause wait. */
  isPaused: () => boolean
  /** Active cancel intent, if any. */
  getCancelIntent: () => CancelIntent | null
  /**
   * Between candidates: if pause was requested, emit pausing/paused and wait
   * until resume or cancel. Returns whether the loop should continue.
   */
  waitIfPaused: (hooks: {
    onPausing: () => void
    onPaused: () => void
    onResume: () => void
  }) => Promise<'continue' | 'cancel'>
}

export function createRandomSearchRunControls(): RandomSearchRunControls {
  let pauseRequested = false
  let paused = false
  let cancelIntent: CancelIntent | null = null
  let resumeResolver: (() => void) | null = null

  const wakePauseWaiter = () => {
    if (resumeResolver) {
      const resolve = resumeResolver
      resumeResolver = null
      resolve()
    }
  }

  return {
    requestPause() {
      if (cancelIntent) return
      pauseRequested = true
    },

    resume() {
      if (cancelIntent) return
      pauseRequested = false
      paused = false
      wakePauseWaiter()
    },

    requestCancel(intent) {
      cancelIntent = intent
      pauseRequested = false
      paused = false
      wakePauseWaiter()
    },

    isPauseRequested() {
      return pauseRequested
    },

    isPaused() {
      return paused
    },

    getCancelIntent() {
      return cancelIntent
    },

    async waitIfPaused(hooks) {
      if (cancelIntent) return 'cancel'
      if (!pauseRequested) return 'continue'

      hooks.onPausing()
      pauseRequested = false
      paused = true
      hooks.onPaused()

      await new Promise<void>((resolve) => {
        resumeResolver = resolve
      })

      if (cancelIntent) {
        paused = false
        return 'cancel'
      }

      paused = false
      hooks.onResume()
      return 'continue'
    },
  }
}
