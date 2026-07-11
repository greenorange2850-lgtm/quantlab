-- AI Trading Research OS — Market Data Engine Schema
-- Version: 002

-- Extend symbol asset classes
-- SQLite doesn't support ALTER CHECK, new installs use 001+002; we add synthetic via seed

-- Additional timeframes
INSERT OR IGNORE INTO timeframes (id, code, minutes, label) VALUES
  ('tf-m1',  'M1',  1,    '1 Minute'),
  ('tf-m5',  'M5',  5,    '5 Minutes'),
  ('tf-m30', 'M30', 30,   '30 Minutes'),
  ('tf-w1',  'W1',  10080, 'Weekly'),
  ('tf-mn',  'MN',  43200, 'Monthly');

-- Market sessions reference table (rename concept from sessions)
CREATE TABLE IF NOT EXISTS market_sessions (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL CHECK (type IN ('asian', 'london', 'new_york', 'overlap', 'off_hours')),
  start_utc TEXT NOT NULL,
  end_utc   TEXT NOT NULL,
  timezone  TEXT NOT NULL DEFAULT 'UTC'
);

INSERT OR IGNORE INTO market_sessions (id, name, type, start_utc, end_utc, timezone) VALUES
  ('ms-asian',   'Asian',             'asian',    '00:00', '08:00', 'UTC'),
  ('ms-london',  'London',            'london',   '08:00', '16:00', 'UTC'),
  ('ms-ny',      'New York',          'new_york', '13:00', '21:00', 'UTC'),
  ('ms-overlap', 'London/NY Overlap', 'overlap',  '13:00', '16:00', 'UTC');

-- Core market data table (single source of truth)
CREATE TABLE IF NOT EXISTS market_data (
  id         TEXT PRIMARY KEY,
  symbol     TEXT NOT NULL,
  timeframe  TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  open       REAL NOT NULL,
  high       REAL NOT NULL,
  low        REAL NOT NULL,
  close      REAL NOT NULL,
  volume     REAL NOT NULL DEFAULT 0,
  spread     REAL NOT NULL DEFAULT 0,
  source     TEXT NOT NULL,
  session    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(symbol, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_market_data_symbol_tf_ts ON market_data(symbol, timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timeframe ON market_data(timeframe);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_tf ON market_data(symbol, timeframe);

-- Import job history
CREATE TABLE IF NOT EXISTS import_jobs (
  id             TEXT PRIMARY KEY,
  file_name      TEXT,
  source         TEXT NOT NULL,
  symbol         TEXT NOT NULL,
  timeframe      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  rows_imported  INTEGER NOT NULL DEFAULT 0,
  rows_rejected  INTEGER NOT NULL DEFAULT 0,
  duration_ms    INTEGER,
  quality_score  REAL,
  errors         TEXT NOT NULL DEFAULT '[]',
  started_at     TEXT,
  completed_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_symbol ON import_jobs(symbol, timeframe);

-- Data quality reports
CREATE TABLE IF NOT EXISTS data_quality (
  id                 TEXT PRIMARY KEY,
  symbol             TEXT NOT NULL,
  timeframe          TEXT NOT NULL,
  quality_score      REAL NOT NULL,
  missing_candles    INTEGER NOT NULL DEFAULT 0,
  duplicate_candles  INTEGER NOT NULL DEFAULT 0,
  invalid_ohlc       INTEGER NOT NULL DEFAULT 0,
  negative_prices    INTEGER NOT NULL DEFAULT 0,
  timezone_issues    INTEGER NOT NULL DEFAULT 0,
  weekend_gaps       INTEGER NOT NULL DEFAULT 0,
  report             TEXT NOT NULL DEFAULT '{}',
  import_job_id      TEXT REFERENCES import_jobs(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_data_quality_symbol ON data_quality(symbol, timeframe);

-- Migrate existing candles data into market_data
INSERT OR IGNORE INTO market_data (id, symbol, timeframe, timestamp, open, high, low, close, volume, spread, source, created_at)
SELECT
  c.id,
  s.name,
  tf.code,
  c.timestamp,
  c.open, c.high, c.low, c.close, c.volume,
  0,
  'migration',
  datetime('now')
FROM candles c
JOIN symbols s ON c.symbol_id = s.id
JOIN timeframes tf ON c.timeframe_id = tf.id;
