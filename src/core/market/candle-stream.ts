import type { Candle } from '../../data/candles.js'

/**
 * Maintains the active bar and rolling history for a subscribed symbol.
 */
export class CandleStream {
  private currentBar: Candle | null = null
  private readonly history: Candle[] = []

  openBar(bar: Candle): void {
    this.currentBar = { ...bar }
    this.history.push(this.currentBar)
  }

  updateBar(bar: Candle): void {
    this.currentBar = { ...bar }
    if (this.history.length > 0) {
      this.history[this.history.length - 1] = this.currentBar
    } else {
      this.history.push(this.currentBar)
    }
  }

  closeBar(bar: Candle): void {
    this.currentBar = { ...bar }
    if (this.history.length > 0) {
      this.history[this.history.length - 1] = this.currentBar
    } else {
      this.history.push(this.currentBar)
    }
  }

  getCurrentBar(): Candle | null {
    return this.currentBar ? { ...this.currentBar } : null
  }

  getHistory(): readonly Candle[] {
    return [...this.history]
  }

  reset(): void {
    this.currentBar = null
    this.history.length = 0
  }

  seekHistory(index: number): Candle | null {
    if (index < 0 || index >= this.history.length) {
      return null
    }

    this.currentBar = { ...this.history[index] }
    return this.getCurrentBar()
  }
}
