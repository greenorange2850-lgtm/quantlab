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

/**
 * Sidebar / drawer:
 * - below lg: 80vw wide, capped at 320px
 * - lg+: fixed 240px (desktop unchanged)
 */
export function sidebarClassName(mobileOpen: boolean): string {
  return [
    'fixed left-0 top-0 z-50 flex h-dvh max-h-dvh flex-col border-r border-border bg-card-solid/90 backdrop-blur-xl',
    'w-[80vw] max-w-[320px] lg:w-[240px] lg:max-w-none',
    'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform',
    'lg:translate-x-0',
    mobileOpen ? 'translate-x-0 shadow-2xl shadow-black/40' : '-translate-x-full lg:shadow-none',
  ].join(' ')
}

/** Backdrop for drawer — dark + subtle blur; visible only below lg. */
export const DRAWER_BACKDROP =
  'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out lg:hidden'

/** Hamburger — visible only below lg; fixed hit target for balanced top bar. */
export const MENU_BUTTON = 'h-11 w-11 shrink-0 lg:hidden'

/** Top bar action cluster — reserves space for future icons without shifting title. */
export const TOP_NAV_ACTIONS =
  'flex min-w-11 shrink-0 items-center justify-end gap-1 sm:gap-3'

/** KPI grid spacing: roomier on phones/tablets; desktop gap unchanged. */
export const KPI_GRID =
  'grid min-w-0 grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 lg:gap-3 xl:grid-cols-11'

/** Primary KPI row — Net Profit / PF / Max DD emphasis. */
export const KPI_PRIMARY_GRID = 'grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3'

/** Secondary KPI row — Win Rate / Trades / Avg RR. */
export const KPI_SECONDARY_GRID = 'grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3'

/** Meta KPI row — strategy labels and streaks. */
export const KPI_META_GRID = 'grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5'
