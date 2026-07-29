import { describe, expect, it } from 'vitest'
import {
  MAIN_CONTENT_OFFSET,
  MAIN_PADDING,
  PAGE_SHELL,
  sidebarClassName,
} from './layout-classes'

describe('layout-classes (mobile shell)', () => {
  it('keeps page shell from horizontal page overflow', () => {
    expect(PAGE_SHELL).toContain('overflow-x-hidden')
    expect(PAGE_SHELL).toContain('min-h-screen')
  })

  it('removes sidebar offset below tablet and restores it at md', () => {
    expect(MAIN_CONTENT_OFFSET).toContain('md:ml-[240px]')
    expect(MAIN_CONTENT_OFFSET).toContain('min-w-0')
    expect(MAIN_CONTENT_OFFSET).not.toMatch(/(^|\s)ml-\[240px\]/)
  })

  it('uses 16px mobile padding and 24px from tablet up', () => {
    expect(MAIN_PADDING).toContain('px-4')
    expect(MAIN_PADDING).toContain('py-4')
    expect(MAIN_PADDING).toContain('md:p-6')
    expect(MAIN_PADDING).toContain('min-w-0')
  })

  it('hides the drawer off-canvas when closed and shows it when open', () => {
    const closed = sidebarClassName(false)
    const open = sidebarClassName(true)

    expect(closed).toContain('-translate-x-full')
    expect(closed).toContain('md:translate-x-0')
    expect(open).toContain('translate-x-0')
    expect(open).toContain('md:translate-x-0')
    expect(open).not.toContain('-translate-x-full')
  })
})
