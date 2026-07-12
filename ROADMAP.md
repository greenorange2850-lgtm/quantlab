# QUANTLAB Roadmap

This document outlines planned work beyond **v0.2.0-alpha.1**.

## v0.2.x — Research & Simulation

Focus: complete the offline research loop and introduce paper trading.

| Feature | Description |
|---------|-------------|
| **Replay Studio** | Wire `ReplayFeed` to a Trade Replay UI with chart sync, stepping, and speed controls |
| **Risk Rules** | Integrate `calculatePositionSize()` and `RiskConfig` into the backtest and execution pipeline |
| **Paper Trading** | Simulated live loop using `ReplayFeed` or `LiveFeed` with real-time portfolio updates |

### v0.2.x milestones
- [ ] Trade Replay page connected to `ReplayFeed`
- [ ] Risk-based position sizing in `BacktestEngine`
- [ ] Paper trading session manager
- [ ] Persist backtest history to database
- [ ] Server-side dashboard aggregation

---

## v0.3 — Live Data & Optimization

Focus: connect to live markets and automate parameter search.

| Feature | Description |
|---------|-------------|
| **Live Binance Adapter** | Implement `LiveFeed.connect()` with Binance WebSocket kline streams |
| **Optimization Engine** | Grid search and walk-forward analysis over strategy parameters |

### v0.3 milestones
- [ ] Binance live feed adapter behind `MarketDataEngine`
- [ ] Walk-forward backtest runner
- [ ] Parameter grid optimizer with report comparison
- [ ] Multi-symbol portfolio backtesting

---

## v0.4 — AI Research Layer

Focus: automated strategy analysis and knowledge accumulation.

| Feature | Description |
|---------|-------------|
| **AI Research Layer** | Post-backtest weakness detection, improvement suggestions, and knowledge base population |

### v0.4 milestones
- [ ] AI analysis engine consuming `BacktestReport`
- [ ] Knowledge base entries from completed backtests
- [ ] Strategy comparison and ranking
- [ ] Natural-language research summaries

---

## Completed (v0.2.0-alpha.1)

- Strategy Engine
- Backtesting Engine
- Analytics Engine
- Dashboard Integration
- Risk Engine Foundation
- Portfolio Engine
- Execution Engine
- Market Data Engine
