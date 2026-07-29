/** Shared layout class tokens for responsive shell (tested + reused). */

/** Outer page shell — clip horizontal page overflow without clipping drawers. */
export const PAGE_SHELL = 'relative min-h-screen overflow-x-hidden'

/**
 * Remove sidebar offset below desktop (lg / 1024px); keep permanent sidebar at lg+.
 * Drawer mode applies below lg per mobile-first overhaul.
 */
export const MAIN_CONTENT_OFFSET = 'min-w-0 w-full lg:ml-[240px]'

/**
 * Page padding:
 * - mobile / tablet: 16px (px-4 / py-4)
 * - desktop (lg+): 24px (lg:p-6, same as prior desktop spacing)
 */
export const MAIN_PADDING = 'mx-auto max-w-[1440px] min-w-0 w-full px-4 py-4 lg:p-6'

/** Sidebar base + transform for mobile/tablet drawer / permanent desktop (lg+). */
export function sidebarClassName(mobileOpen: boolean): string {
  return [
    'fixed left-0 top-0 z-50 flex h-screen w-[240px] max-w-[85vw] flex-col border-r border-border bg-card-solid/80 backdrop-blur-xl',
    'transition-transform duration-200 ease-out will-change-transform',
    'lg:translate-x-0',
    mobileOpen ? 'translate-x-0' : '-translate-x-full',
  ].join(' ')
}

/** Backdrop for drawer — visible only below lg. */
export const DRAWER_BACKDROP =
  'fixed inset-0 z-40 bg-black/60 lg:hidden'

/** Hamburger — visible only below lg. */
export const MENU_BUTTON = 'h-11 w-11 shrink-0 lg:hidden'
