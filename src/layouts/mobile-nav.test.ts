import { describe, expect, it } from 'vitest'

/** Mirrors MainLayout Escape + route-close behavior for unit coverage. */
export function shouldCloseMobileNav(event: { type: string; key?: string }): boolean {
  if (event.type === 'keydown') return event.key === 'Escape'
  if (event.type === 'backdropclick' || event.type === 'routechange') return true
  return false
}

describe('mobile nav close rules', () => {
  it('closes on Escape', () => {
    expect(shouldCloseMobileNav({ type: 'keydown', key: 'Escape' })).toBe(true)
    expect(shouldCloseMobileNav({ type: 'keydown', key: 'Enter' })).toBe(false)
  })

  it('closes on backdrop click and route change', () => {
    expect(shouldCloseMobileNav({ type: 'backdropclick' })).toBe(true)
    expect(shouldCloseMobileNav({ type: 'routechange' })).toBe(true)
  })
})
