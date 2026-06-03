CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  model_number TEXT NOT NULL,
  name TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  price REAL,
  case_number TEXT,
  memo TEXT,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS part_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  label TEXT,
  value TEXT NOT NULL,
  unit TEXT,
  normalized_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
  UNIQUE (part_id, key)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS part_tags (
  part_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (part_id, tag_id),
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('initial', 'in', 'out', 'set', 'adjustment')),
  quantity INTEGER NOT NULL,
  before_quantity INTEGER NOT NULL,
  after_quantity INTEGER NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parts_category_id ON parts(category_id);
CREATE INDEX IF NOT EXISTS idx_parts_model_number ON parts(model_number);
CREATE INDEX IF NOT EXISTS idx_parts_case_number ON parts(case_number);
CREATE INDEX IF NOT EXISTS idx_parts_stock_quantity ON parts(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_parts_search_text ON parts(search_text);
CREATE INDEX IF NOT EXISTS idx_part_attributes_part_id ON part_attributes(part_id);
CREATE INDEX IF NOT EXISTS idx_part_attributes_key_value ON part_attributes(key, value);
CREATE INDEX IF NOT EXISTS idx_part_tags_tag_id ON part_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_part_id_created_at ON stock_movements(part_id, created_at DESC);
