CREATE TABLE IF NOT EXISTS learners (
  id           TEXT PRIMARY KEY,
  display_name TEXT,
  settings     TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  uid        TEXT PRIMARY KEY,
  tags       TEXT NOT NULL DEFAULT '[]', -- JSON array
  payload    TEXT NOT NULL,              -- opaque JSON; never parsed by server
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_tags ON items(tags);

CREATE TABLE IF NOT EXISTS learner_states (
  learner_id       TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  item_uid         TEXT NOT NULL REFERENCES items(uid)   ON DELETE CASCADE,
  fsrs_state       TEXT,    -- JSON ts-fsrs Card; NULL = never reviewed (new card)
  due_at           TEXT,    -- ISO8601; denormalized from fsrs_state for indexed queries
  last_reviewed_at TEXT,
  PRIMARY KEY (learner_id, item_uid)
);
CREATE INDEX IF NOT EXISTS idx_ls_due ON learner_states(learner_id, due_at);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id  TEXT NOT NULL REFERENCES learners(id),
  item_uid    TEXT NOT NULL REFERENCES items(uid),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  elapsed_ms  INTEGER,
  stability   REAL,
  difficulty  REAL,
  state       INTEGER,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_learner_day ON reviews(learner_id, reviewed_at);

CREATE TABLE IF NOT EXISTS learner_config (
  learner_id         TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  daily_new_limit    INTEGER NOT NULL DEFAULT 20,
  daily_review_limit INTEGER NOT NULL DEFAULT 200,
  target_retention   REAL    NOT NULL DEFAULT 0.9,
  tz_offset_minutes  INTEGER NOT NULL DEFAULT 0,  -- learner's UTC offset in minutes
  fsrs_weights       TEXT                         -- JSON number[]; NULL = ts-fsrs defaults
);
