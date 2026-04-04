CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL DEFAULT 'default',
  avatar TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  settings TEXT
);

CREATE TABLE IF NOT EXISTS decks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT,
  source_path TEXT,
  settings TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  external_id TEXT,
  type TEXT NOT NULL,
  chapter INTEGER,
  chapter_name TEXT,
  tags TEXT,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  front_raw TEXT,
  back_raw TEXT,
  target_word TEXT,
  target_reading TEXT,
  frequency_rank INTEGER,
  cefr TEXT,
  audio_native TEXT,
  audio_sentence TEXT,
  speech_target TEXT,
  speech_accept TEXT,
  context_sentence TEXT,
  situation TEXT,
  fsrs_state TEXT,
  due_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due_at);
CREATE INDEX IF NOT EXISTS idx_cards_deck_due ON cards(deck_id, due_at);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  elapsed_ms INTEGER,
  state TEXT,
  stability REAL,
  difficulty REAL,
  reviewed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_card ON reviews(card_id);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(reviewed_at);

CREATE TABLE IF NOT EXISTS streaks (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  cards_reviewed INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL UNIQUE,
  unlocked_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_config (
  id INTEGER PRIMARY KEY,
  deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
  daily_new_limit INTEGER DEFAULT 20,
  daily_review_limit INTEGER DEFAULT 200,
  new_card_order TEXT DEFAULT 'sequential',
  target_retention REAL DEFAULT 0.9,
  fsrs_weights TEXT,
  UNIQUE(deck_id)
);

-- seed default user
INSERT OR IGNORE INTO users (id, username) VALUES (1, 'default');

-- seed global learning config (deck_id NULL = global defaults)
INSERT OR IGNORE INTO learning_config (id, deck_id) VALUES (1, NULL);
