CREATE TABLE IF NOT EXISTS part_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#64748b',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE parts ADD COLUMN status_id INTEGER REFERENCES part_statuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parts_status_id ON parts(status_id);

-- 既定のステータス例。ユーザーは後から自由に編集・追加・削除できる。
INSERT OR IGNORE INTO part_statuses (name, slug, color, sort_order) VALUES
  ('現行品', 'active', '#16a34a', 10),
  ('生産終了', 'obsolete', '#dc2626', 20);
