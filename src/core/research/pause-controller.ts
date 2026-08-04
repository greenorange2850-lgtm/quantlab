import type { PauseController } from './types.js'

export function createPauseController(): PauseController {
  let paused = false
  let waiters: Array<() => void> = []

  return {
    get paused() {
      return paused
    },
    pause() {
      paused = true
    },
    resume() {
      paused = false
      const pending = waiters
      waiters = []
      for (const resolve of pending) resolve()
    },
    waitIfPaused() {
      if (!paused) return Promise.resolve()
      return new Promise<void>((resolve) => {
        waiters.push(resolve)
      })
    },
  }
}
