import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Signed currency for P&L-style metrics: +$1,234.56 / -$1,234.56
 */
export function formatCurrency(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * Absolute currency: $1,234.56 / -$1,234.56 (no forced +).
 */
export function formatCurrencyAbsolute(value: number, decimals = 2): string {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return value < 0 ? `-$${abs}` : `$${abs}`
}

/** Percentages — 2 decimals by default. */
export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/** Unsigned percent (win rate, etc.): 55.25% */
export function formatPercentUnsigned(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

/** Generic numbers / ratios — never long floats. */
export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Ratios (PF, Sharpe, RR, recovery): always 2 decimals. */
export function formatRatio(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(decimals)
}
