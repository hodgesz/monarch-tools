-- Monarch Tools local warehouse schema v1

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  type_name TEXT,
  type_display TEXT,
  subtype_name TEXT,
  subtype_display TEXT,
  institution_name TEXT,
  mask TEXT,
  is_asset INTEGER NOT NULL DEFAULT 1,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  include_in_net_worth INTEGER NOT NULL DEFAULT 1,
  current_balance REAL,
  created_at TEXT,
  last_seen_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS account_balances (
  account_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  balance REAL NOT NULL,
  PRIMARY KEY (account_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_id TEXT,
  group_name TEXT,
  group_type TEXT,              -- income / expense / transfer
  is_system INTEGER DEFAULT 0,
  is_disabled INTEGER DEFAULT 0,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  account_id TEXT,
  category_id TEXT,
  merchant_id TEXT,
  merchant_name TEXT,           -- denormalized for merchants we don't have an id for
  description TEXT,
  original_description TEXT,
  notes TEXT,
  is_pending INTEGER DEFAULT 0,
  is_recurring INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0,
  is_split INTEGER DEFAULT 0,
  needs_review INTEGER DEFAULT 0,
  tags_json TEXT,               -- JSON array of tag names
  created_at TEXT,
  updated_at TEXT,
  last_seen_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_last_seen ON transactions(last_seen_at);

CREATE TABLE IF NOT EXISTS budget_snapshots (
  month TEXT NOT NULL,          -- YYYY-MM-01
  category_id TEXT NOT NULL,
  category_name TEXT,
  planned_amount REAL NOT NULL,
  actual_amount REAL NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (month, category_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_budget_month ON budget_snapshots(month);

CREATE TABLE IF NOT EXISTS recurring_streams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount REAL,
  frequency TEXT,
  recurring_type TEXT,
  day_of_month INTEGER,
  base_date TEXT,
  last_seen_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,           -- backfill | incremental
  started_at TEXT NOT NULL,
  finished_at TEXT,
  start_date TEXT,
  end_date TEXT,
  transactions_upserted INTEGER DEFAULT 0,
  accounts_upserted INTEGER DEFAULT 0,
  categories_upserted INTEGER DEFAULT 0,
  balances_upserted INTEGER DEFAULT 0,
  budgets_upserted INTEGER DEFAULT 0,
  recurring_upserted INTEGER DEFAULT 0,
  soft_deleted INTEGER DEFAULT 0,
  error TEXT
);
