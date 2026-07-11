-- AI Trading Research OS — Initial Schema
-- Version: 001

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Market Data ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS symbols (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('forex', 'crypto', 'indices', 'commodities')),
  pip_size    REAL NOT NULL DEFAULT 0.0001,
  tick_size   REAL NOT NULL DEFAULT 0.00001,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timeframes (
  id      TEXT PRIMARY KEY,
  code    TEXT NOT NULL UNIQUE,
  minutes INTEGER NOT NULL,
  label   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL CHECK (type IN ('asian', 'london', 'new_york', 'overlap', 'off_hours')),
  start_utc TEXT NOT NULL,
  end_utc   TEXT NOT NULL,
  timezone  TEXT NOT NULL DEFAULT 'UTC'
);

CREATE TABLE IF NOT EXISTS candles (
  id           TEXT PRIMARY KEY,
  symbol_id    TEXT NOT NULL REFERENCES symbols(id),
  timeframe_id TEXT NOT NULL REFERENCES timeframes(id),
  timestamp    TEXT NOT NULL,
  open         REAL NOT NULL,
  high         REAL NOT NULL,
  low          REAL NOT NULL,
  close        REAL NOT NULL,
  volume       REAL NOT NULL DEFAULT 0,
  UNIQUE(symbol_id, timeframe_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles(symbol_id, timeframe_id, timestamp);

-- ─── Pattern Events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crt_events (
  id            TEXT PRIMARY KEY,
  symbol_id     TEXT NOT NULL REFERENCES symbols(id),
  timeframe_id  TEXT NOT NULL REFERENCES timeframes(id),
  timestamp     TEXT NOT NULL,
  price         REAL NOT NULL,
  direction     TEXT NOT NULL,
  confidence    REAL NOT NULL DEFAULT 0,
  range_high    REAL NOT NULL,
  range_low     REAL NOT NULL,
  close_position REAL NOT NULL,
  metadata      TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS fvg_events (
  id           TEXT PRIMARY KEY,
  symbol_id    TEXT NOT NULL REFERENCES symbols(id),
  timeframe_id TEXT NOT NULL REFERENCES timeframes(id),
  timestamp    TEXT NOT NULL,
  price        REAL NOT NULL,
  direction    TEXT NOT NULL,
  confidence   REAL NOT NULL DEFAULT 0,
  gap_high     REAL NOT NULL,
  gap_low      REAL NOT NULL,
  filled       INTEGER NOT NULL DEFAULT 0,
  metadata     TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS liquidity_events (
  id           TEXT PRIMARY KEY,
  symbol_id    TEXT NOT NULL REFERENCES symbols(id),
  timeframe_id TEXT NOT NULL REFERENCES timeframes(id),
  timestamp    TEXT NOT NULL,
  price        REAL NOT NULL,
  direction    TEXT NOT NULL,
  confidence   REAL NOT NULL DEFAULT 0,
  swept_level  REAL NOT NULL,
  reclaimed    INTEGER NOT NULL DEFAULT 0,
  metadata     TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS mss_events (
  id                 TEXT PRIMARY KEY,
  symbol_id          TEXT NOT NULL REFERENCES symbols(id),
  timeframe_id       TEXT NOT NULL REFERENCES timeframes(id),
  timestamp          TEXT NOT NULL,
  price              REAL NOT NULL,
  direction          TEXT NOT NULL,
  confidence         REAL NOT NULL DEFAULT 0,
  previous_structure TEXT NOT NULL,
  new_structure      TEXT NOT NULL,
  metadata           TEXT NOT NULL DEFAULT '{}'
);

-- ─── Strategies & Versioning ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS strategies (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'draft',
  current_version_id TEXT,
  tags               TEXT NOT NULL DEFAULT '[]',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id                TEXT PRIMARY KEY,
  strategy_id       TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  version           TEXT NOT NULL,
  version_number    INTEGER NOT NULL,
  rules             TEXT NOT NULL DEFAULT '{}',
  filters           TEXT NOT NULL DEFAULT '{}',
  metrics           TEXT,
  ai_notes          TEXT,
  parent_version_id TEXT REFERENCES strategy_versions(id),
  changelog         TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(strategy_id, version_number)
);

-- ─── Backtests & Trades ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS backtests (
  id                  TEXT PRIMARY KEY,
  strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id),
  symbol_id           TEXT NOT NULL REFERENCES symbols(id),
  timeframe_id        TEXT NOT NULL REFERENCES timeframes(id),
  status              TEXT NOT NULL DEFAULT 'queued',
  start_date          TEXT NOT NULL,
  end_date            TEXT NOT NULL,
  initial_capital     REAL NOT NULL DEFAULT 10000,
  metrics             TEXT NOT NULL DEFAULT '{}',
  equity_curve        TEXT NOT NULL DEFAULT '[]',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT
);

CREATE TABLE IF NOT EXISTS trades (
  id           TEXT PRIMARY KEY,
  backtest_id  TEXT NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
  symbol_id    TEXT NOT NULL REFERENCES symbols(id),
  direction    TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  result       TEXT NOT NULL CHECK (result IN ('win', 'loss', 'breakeven')),
  entry_time   TEXT NOT NULL,
  exit_time    TEXT NOT NULL,
  entry_price  REAL NOT NULL,
  exit_price   REAL NOT NULL,
  stop_loss    REAL NOT NULL,
  take_profit  REAL NOT NULL,
  risk_reward  REAL NOT NULL,
  pnl          REAL NOT NULL,
  pnl_percent  REAL NOT NULL,
  session      TEXT NOT NULL,
  timeframe    TEXT NOT NULL,
  patterns     TEXT NOT NULL DEFAULT '[]',
  metadata     TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_trades_backtest ON trades(backtest_id);

-- ─── Optimization ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS optimization_history (
  id                  TEXT PRIMARY KEY,
  strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id),
  status              TEXT NOT NULL DEFAULT 'idle',
  parameters          TEXT NOT NULL DEFAULT '[]',
  results             TEXT NOT NULL DEFAULT '[]',
  best_result_id      TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT
);

-- ─── AI Analysis ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_analysis (
  id                  TEXT PRIMARY KEY,
  strategy_version_id TEXT NOT NULL REFERENCES strategy_versions(id),
  backtest_id         TEXT REFERENCES backtests(id),
  confidence          REAL NOT NULL DEFAULT 0,
  reasoning           TEXT NOT NULL DEFAULT '',
  suggestions         TEXT NOT NULL DEFAULT '[]',
  weaknesses          TEXT NOT NULL DEFAULT '[]',
  proposed_version_id TEXT REFERENCES strategy_versions(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Knowledge Base ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_base (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL,
  strategy_id TEXT REFERENCES strategies(id),
  backtest_id TEXT REFERENCES backtests(id),
  condition   TEXT NOT NULL,
  value       TEXT NOT NULL,
  confidence  REAL NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base(category);

-- ─── Reports & Settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id                  TEXT PRIMARY KEY,
  type                TEXT NOT NULL,
  title               TEXT NOT NULL,
  strategy_version_id TEXT REFERENCES strategy_versions(id),
  backtest_id         TEXT REFERENCES backtests(id),
  content             TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Migrations Tracking ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
