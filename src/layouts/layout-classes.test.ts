import { describe, expect, it } from 'vitest'
import {
  DRAWER_BACKDROP,
  MAIN_CONTENT_OFFSET,
  MAIN_PADDING,
  MENU_BUTTON,
  PAGE_SHELL,
  sidebarClassName,
} from './layout-classes'

describe('layout-classes (mobile-first shell)', () => {
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

  it('hides the drawer off-canvas when closed and shows it when open (permanent at lg)', () => {
    const closed = sidebarClassName(false)
    const open = sidebarClassName(true)

    expect(closed).toContain('-translate-x-full')
    expect(closed).toContain('lg:translate-x-0')
    expect(open).toContain('translate-x-0')
    expect(open).toContain('lg:translate-x-0')
    expect(open).not.toContain('-translate-x-full')
  })

  it('scopes backdrop and hamburger to below-lg only', () => {
    expect(DRAWER_BACKDROP).toContain('lg:hidden')
    expect(MENU_BUTTON).toContain('lg:hidden')
  })
})
