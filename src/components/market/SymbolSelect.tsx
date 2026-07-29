import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Search, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  BINANCE_QUOTE_ASSETS,
  DEFAULT_BINANCE_QUOTE,
  getSymbolSelectViewState,
  type BinanceQuoteAsset,
  type BinanceTradingPair,
} from '@/data/binance-exchange-info'
import { useFilteredBinanceTradingPairs } from '@/api/queries/binance-market'

interface SymbolSelectProps {
  value: string
  onChange: (symbol: string) => void
  className?: string
  disabled?: boolean
  id?: string
}

export function SymbolSelect({
  value,
  onChange,
  className,
  disabled = false,
  id,
}: SymbolSelectProps) {
  const generatedId = useId()
  const listboxId = useId()
  const inputId = id ?? generatedId
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [quoteAsset, setQuoteAsset] = useState<BinanceQuoteAsset>(DEFAULT_BINANCE_QUOTE)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  /** Preserve selection display if a later refresh fails. */
  const [lastKnownPair, setLastKnownPair] = useState<BinanceTradingPair | null>(null)

  const { filtered, pairs, isLoading, isError, error, refetch, isFetching } =
    useFilteredBinanceTradingPairs(quoteAsset, search)

  const selectedPair = useMemo(() => {
    const fromList = pairs.find((pair) => pair.symbol === value)
    if (fromList) return fromList
    if (lastKnownPair?.symbol === value) return lastKnownPair
    return null
  }, [pairs, value, lastKnownPair])

  useEffect(() => {
    const match = pairs.find((pair) => pair.symbol === value)
    if (match) setLastKnownPair(match)
  }, [pairs, value])

  useEffect(() => {
    setHighlightIndex(0)
  }, [search, quoteAsset, open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) {
      queueMicrotask(() => searchRef.current?.focus())
    }
  }, [open])

  const viewState = getSymbolSelectViewState({
    isLoading: isLoading && pairs.length === 0,
    isError: isError && pairs.length === 0,
    filteredCount: filtered.length,
  })

  const selectPair = (pair: BinanceTradingPair) => {
    setLastKnownPair(pair)
    onChange(pair.symbol)
    setOpen(false)
    setSearch('')
  }

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setHighlightIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setHighlightIndex(Math.max(filtered.length - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const pair = filtered[highlightIndex]
      if (pair) selectPair(pair)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative min-w-0 w-full', className)}>
      <button
        type="button"
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-white/[0.03] px-3 text-left text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-accent/40 ring-2 ring-accent/30',
        )}
      >
        <span className={cn('min-w-0 truncate font-mono', !selectedPair && 'text-muted-foreground')}>
          {selectedPair ? selectedPair.label : value || 'Select market pair'}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-2 max-h-[min(24rem,70vh)] overflow-hidden rounded-xl border border-border bg-card-solid/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
          role="dialog"
          aria-label="Select trading pair"
        >
          <div className="border-b border-border p-2">
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
              {BINANCE_QUOTE_ASSETS.map((quote) => (
                <button
                  key={quote}
                  type="button"
                  onClick={() => setQuoteAsset(quote)}
                  className={cn(
                    'min-h-9 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors',
                    quoteAsset === quote
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted hover:bg-white/5 hover:text-foreground',
                  )}
                >
                  {quote}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search symbol or base asset"
                className="h-11 bg-white/[0.03] pl-9"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={
                  filtered[highlightIndex] ? `${listboxId}-opt-${filtered[highlightIndex].symbol}` : undefined
                }
              />
            </div>
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label={`${quoteAsset} pairs`}
            className="max-h-64 overflow-y-auto p-1"
          >
            {viewState === 'loading' && (
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Binance markets…
              </div>
            )}

            {viewState === 'error' && (
              <div className="space-y-3 px-3 py-6 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-danger">
                  <AlertCircle className="h-4 w-4" />
                  {error instanceof Error ? error.message : 'Failed to load markets'}
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            )}

            {viewState === 'empty' && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                No pairs match “{search || quoteAsset}”
              </div>
            )}

            {viewState === 'ready' &&
              filtered.map((pair, index) => {
                const selected = pair.symbol === value
                const active = index === highlightIndex
                return (
                  <button
                    key={pair.symbol}
                    type="button"
                    id={`${listboxId}-opt-${pair.symbol}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectPair(pair)}
                    className={cn(
                      'flex w-full min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      active && 'bg-white/5',
                      selected && 'text-accent',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{pair.label}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {pair.symbol}
                      </span>
                    </span>
                    {selected ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
                  </button>
                )
              })}
          </div>

          {isFetching && pairs.length > 0 ? (
            <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              Refreshing markets…
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
