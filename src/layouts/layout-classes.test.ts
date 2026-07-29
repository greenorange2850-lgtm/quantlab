import { describe, expect, it } from 'vitest'
import {
  DRAWER_BACKDROP,
  KPI_GRID,
  MAIN_CONTENT_OFFSET,
  MAIN_PADDING,
  MENU_BUTTON,
  PAGE_SHELL,
  TOP_NAV_ACTIONS,
  sidebarClassName,
} from './layout-classes'

describe('layout-classes (mobile UX polish)', () => {
  it('keeps page shell from horizontal page overflow', () => {
    expect(PAGE_SHELL).toContain('overflow-x-hidden')
    expect(PAGE_SHELL).toContain('min-h-screen')
  })

  it('removes sidebar offset below lg and restores it at lg+', () => {
    expect(MAIN_CONTENT_OFFSET).toContain('lg:ml-[240px]')
    expect(MAIN_CONTENT_OFFSET).toContain('min-w-0')
    expect(MAIN_CONTENT_OFFSET).not.toMatch(/(^|\s)ml-\[240px\]/)
    expect(MAIN_CONTENT_OFFSET).not.toContain('md:ml-[240px]')
  })

  it('uses 16px padding below lg and 24px from lg up', () => {
    expect(MAIN_PADDING).toContain('px-4')
    expect(MAIN_PADDING).toContain('py-4')
    expect(MAIN_PADDING).toContain('lg:p-6')
    expect(MAIN_PADDING).toContain('min-w-0')
  })

  it('uses 80vw / max 320px drawer below lg and 240px at lg+', () => {
    const closed = sidebarClassName(false)
    const open = sidebarClassName(true)

    expect(closed).toContain('w-[80vw]')
    expect(closed).toContain('max-w-[320px]')
    expect(closed).toContain('lg:w-[240px]')
    expect(closed).toContain('lg:max-w-none')
    expect(closed).toContain('-translate-x-full')
    expect(closed).toContain('lg:translate-x-0')
    expect(closed).toContain('duration-300')

    expect(open).toContain('translate-x-0')
    expect(open).toContain('lg:translate-x-0')
    expect(open).not.toContain('-translate-x-full')
  })

  it('uses a dark blurred backdrop below lg only', () => {
    expect(DRAWER_BACKDROP).toContain('bg-black/60')
    expect(DRAWER_BACKDROP).toContain('backdrop-blur-sm')
    expect(DRAWER_BACKDROP).toContain('lg:hidden')
  })

  it('scopes hamburger to below-lg and reserves top-bar action space', () => {
    expect(MENU_BUTTON).toContain('lg:hidden')
    expect(TOP_NAV_ACTIONS).toContain('min-w-11')
    expect(TOP_NAV_ACTIONS).toContain('justify-end')
  })

  it('gives KPI cards more room on mobile without changing desktop gap', () => {
    expect(KPI_GRID).toContain('grid-cols-2')
    expect(KPI_GRID).toContain('md:grid-cols-3')
    expect(KPI_GRID).toContain('lg:grid-cols-6')
    expect(KPI_GRID).toContain('xl:grid-cols-11')
    expect(KPI_GRID).toContain('gap-4')
    expect(KPI_GRID).toContain('lg:gap-3')
  })
})
