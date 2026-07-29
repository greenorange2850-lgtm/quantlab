/** Shared layout class tokens for responsive shell (tested + reused). */

/** Outer page shell — clip horizontal page overflow without clipping drawers. */
export const PAGE_SHELL = 'relative min-h-screen overflow-x-hidden'

/** Remove sidebar offset below tablet; keep desktop ml-[240px]. */
export const MAIN_CONTENT_OFFSET = 'min-w-0 w-full md:ml-[240px]'

/**
 * Page padding:
 * - mobile: 16px (px-4 / py-4)
 * - tablet+: 24px (md:p-6, same as prior desktop spacing)
 */
export const MAIN_PADDING = 'mx-auto max-w-[1440px] min-w-0 w-full px-4 py-4 md:p-6'

/** Sidebar base + transform for mobile drawer / permanent desktop. */
export function sidebarClassName(mobileOpen: boolean): string {
  return [
    'fixed left-0 top-0 z-50 flex h-screen w-[240px] flex-col border-r border-border bg-card-solid/80 backdrop-blur-xl',
    'transition-transform duration-200 ease-out will-change-transform',
    'md:translate-x-0',
    mobileOpen ? 'translate-x-0' : '-translate-x-full',
  ].join(' ')
}
