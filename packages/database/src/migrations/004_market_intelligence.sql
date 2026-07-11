-- AI Trading Research OS — Market Intelligence Engine Schema
-- Version: 004

CREATE TABLE IF NOT EXISTS market_context (
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL,
  analysis_id   TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  timeframe     TEXT NOT NULL,
  timestamp     TEXT NOT NULL,
  conditions    TEXT NOT NULL DEFAULT '{}',
  explanation   TEXT NOT NULL DEFAULT '{}',
  recommendations TEXT NOT NULL DEFAULT '[]',
  analyzed_at   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_context_event ON market_context(event_id);
CREATE INDEX IF NOT EXISTS idx_market_context_symbol ON market_context(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_market_context_analysis ON market_context(analysis_id);

CREATE TABLE IF NOT EXISTS market_scores (
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL,
  analysis_id   TEXT NOT NULL,
  quality_score REAL NOT NULL DEFAULT 0,
  confidence    REAL NOT NULL DEFAULT 0,
  risk_score    REAL NOT NULL DEFAULT 0,
  opportunity_score REAL NOT NULL DEFAULT 0,
  opportunity_level TEXT NOT NULL DEFAULT 'medium',
  risk_level    TEXT NOT NULL DEFAULT 'medium',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_scores_event ON market_scores(event_id);
CREATE INDEX IF NOT EXISTS idx_market_scores_analysis ON market_scores(analysis_id);

CREATE TABLE IF NOT EXISTS market_tags (
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL,
  analysis_id   TEXT NOT NULL,
  tag           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_tags_event ON market_tags(event_id);
CREATE INDEX IF NOT EXISTS idx_market_tags_tag ON market_tags(tag);

CREATE TABLE IF NOT EXISTS market_conditions (
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL,
  analysis_id   TEXT NOT NULL,
  engine        TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  value         TEXT NOT NULL DEFAULT '',
  score         REAL NOT NULL DEFAULT 0,
  weight        REAL NOT NULL DEFAULT 1.0,
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_conditions_event ON market_conditions(event_id);
CREATE INDEX IF NOT EXISTS idx_market_conditions_engine ON market_conditions(engine);

CREATE TABLE IF NOT EXISTS intelligence_runs (
  id              TEXT PRIMARY KEY,
  symbol          TEXT NOT NULL,
  timeframe       TEXT NOT NULL,
  events_analyzed INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  debug_mode      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'completed',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intelligence_runs_symbol ON intelligence_runs(symbol, timeframe);
