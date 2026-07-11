-- AI Trading Research OS — Rule Engine Schema
-- Version: 003

CREATE TABLE IF NOT EXISTS rule_definitions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  version     TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT 'system',
  parameters  TEXT NOT NULL DEFAULT '{}',
  dependencies TEXT NOT NULL DEFAULT '[]',
  priority    INTEGER NOT NULL DEFAULT 50,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS market_events (
  id          TEXT PRIMARY KEY,
  rule_id     TEXT NOT NULL,
  rule_name   TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  timeframe   TEXT NOT NULL,
  timestamp   TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish', 'neutral', 'warning', 'rejected')),
  confidence  REAL NOT NULL DEFAULT 0,
  score       REAL NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL DEFAULT '',
  metadata    TEXT NOT NULL DEFAULT '{}',
  candle_index INTEGER,
  scan_id     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_events_symbol_tf ON market_events(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_market_events_timestamp ON market_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_events_rule ON market_events(rule_name);
CREATE INDEX IF NOT EXISTS idx_market_events_scan ON market_events(scan_id);
CREATE INDEX IF NOT EXISTS idx_market_events_lookup ON market_events(symbol, timeframe, timestamp, rule_name);

CREATE TABLE IF NOT EXISTS event_tags (
  id       TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_tags_event ON event_tags(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tags_tag ON event_tags(tag);

CREATE TABLE IF NOT EXISTS event_dependencies (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
  depends_on_event_id TEXT NOT NULL,
  depends_on_rule TEXT NOT NULL,
  relation        TEXT NOT NULL DEFAULT 'requires'
);

CREATE INDEX IF NOT EXISTS idx_event_deps_event ON event_dependencies(event_id);

CREATE TABLE IF NOT EXISTS event_scores (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
  metric     TEXT NOT NULL,
  value      REAL NOT NULL,
  weight     REAL NOT NULL DEFAULT 1.0
);

CREATE INDEX IF NOT EXISTS idx_event_scores_event ON event_scores(event_id);

CREATE TABLE IF NOT EXISTS rule_scans (
  id           TEXT PRIMARY KEY,
  symbol       TEXT NOT NULL,
  timeframe    TEXT NOT NULL,
  rules        TEXT NOT NULL DEFAULT '[]',
  events_found INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER,
  debug_mode   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'completed',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rule_scans_symbol ON rule_scans(symbol, timeframe);
