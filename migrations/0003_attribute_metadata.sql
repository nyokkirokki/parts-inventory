CREATE TABLE IF NOT EXISTS attribute_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text' CHECK (data_type IN ('text', 'number', 'boolean', 'date')),
  unit TEXT,
  group_name TEXT,
  is_searchable INTEGER NOT NULL DEFAULT 1 CHECK (is_searchable IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE (category_id, key)
);

CREATE TABLE IF NOT EXISTS part_attribute_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL,
  attribute_definition_id INTEGER NOT NULL,
  value_text TEXT,
  value_number REAL,
  unit TEXT,
  display_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
  FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions(id) ON DELETE CASCADE,
  UNIQUE (part_id, attribute_definition_id)
);

CREATE TABLE IF NOT EXISTS category_list_headers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  attribute_definition_id INTEGER,
  field_key TEXT,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attribute_definitions_category_key ON attribute_definitions(category_id, key);
CREATE INDEX IF NOT EXISTS idx_attribute_definitions_category_searchable ON attribute_definitions(category_id, is_searchable, sort_order);
CREATE INDEX IF NOT EXISTS idx_part_attribute_values_part_id ON part_attribute_values(part_id);
CREATE INDEX IF NOT EXISTS idx_part_attribute_values_definition_text ON part_attribute_values(attribute_definition_id, value_text);
CREATE INDEX IF NOT EXISTS idx_part_attribute_values_definition_number ON part_attribute_values(attribute_definition_id, value_number);
CREATE INDEX IF NOT EXISTS idx_category_list_headers_category_order ON category_list_headers(category_id, sort_order);

INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT DISTINCT p.category_id, pa.key, COALESCE(NULLIF(pa.label, ''), pa.key), 'text', NULLIF(pa.unit, ''), '既存属性', 1, 100
FROM part_attributes pa
JOIN parts p ON p.id = pa.part_id;

INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'resistance', '抵抗値', 'number', 'Ω', '電気的特性', 1, 10 FROM categories WHERE slug = 'passives';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'capacitance', '静電容量', 'number', 'F', '電気的特性', 1, 20 FROM categories WHERE slug = 'passives';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'voltage', '定格電圧', 'number', 'V', '電気的特性', 1, 30 FROM categories WHERE slug = 'passives';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'tolerance', '許容差', 'number', '%', '電気的特性', 1, 40 FROM categories WHERE slug = 'passives';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'power_rating', '定格電力', 'number', 'W', '電気的特性', 1, 50 FROM categories WHERE slug = 'passives';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'package', 'パッケージ', 'text', NULL, '外形', 1, 60 FROM categories WHERE slug = 'passives';

INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'emitted_color', '発光色', 'text', NULL, '電気的特性', 1, 10 FROM categories WHERE slug = 'led-display';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'forward_voltage', '順方向電圧', 'number', 'V', '電気的特性', 1, 20 FROM categories WHERE slug = 'led-display';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'forward_current', '順方向電流', 'number', 'mA', '電気的特性', 1, 30 FROM categories WHERE slug = 'led-display';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'wavelength', '波長', 'number', 'nm', '電気的特性', 1, 40 FROM categories WHERE slug = 'led-display';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'package', 'パッケージ', 'text', NULL, '外形', 1, 50 FROM categories WHERE slug = 'led-display';

INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'pins', 'ピン数', 'number', NULL, '外形', 1, 10 FROM categories WHERE slug = 'semiconductors';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'package', 'パッケージ', 'text', NULL, '外形', 1, 20 FROM categories WHERE slug = 'semiconductors';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'supply_voltage', '電源電圧', 'number', 'V', '電気的特性', 1, 30 FROM categories WHERE slug = 'semiconductors';
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'interface', 'インターフェース', 'text', NULL, 'インターフェース', 1, 40 FROM categories WHERE slug IN ('semiconductors', 'sensors', 'mcus-boards', 'wireless-modules');
INSERT OR IGNORE INTO attribute_definitions (category_id, key, label, data_type, unit, group_name, is_searchable, sort_order)
SELECT id, 'frequency', '周波数', 'number', 'Hz', '電気的特性', 1, 50 FROM categories WHERE slug IN ('semiconductors', 'mcus-boards', 'wireless-modules');

INSERT OR IGNORE INTO part_attribute_values (part_id, attribute_definition_id, value_text, value_number, unit, display_value)
SELECT
  pa.part_id,
  ad.id,
  pa.value,
  CASE
    WHEN pa.value GLOB '-[0-9]*' OR pa.value GLOB '[0-9]*' THEN CAST(pa.value AS REAL)
    ELSE NULL
  END,
  pa.unit,
  TRIM(pa.value || COALESCE(pa.unit, ''))
FROM part_attributes pa
JOIN parts p ON p.id = pa.part_id
JOIN attribute_definitions ad ON ad.category_id = p.category_id AND ad.key = pa.key;

INSERT INTO category_list_headers (category_id, field_key, label, sort_order, is_visible)
SELECT c.id, defaults.field_key, defaults.label, defaults.sort_order, 1
FROM categories c
JOIN (
  SELECT 'modelNumber' AS field_key, '型番' AS label, 10 AS sort_order
  UNION ALL SELECT 'location', '保管場所', 80
  UNION ALL SELECT 'stockQuantity', '在庫数', 90
  UNION ALL SELECT 'archived', 'アーカイブ済み', 100
  UNION ALL SELECT 'actions', '操作', 110
) defaults
WHERE c.slug IN ('passives', 'led-display', 'semiconductors')
  AND NOT EXISTS (
    SELECT 1 FROM category_list_headers h
    WHERE h.category_id = c.id AND h.field_key = defaults.field_key
  );

INSERT INTO category_list_headers (category_id, attribute_definition_id, label, sort_order, is_visible)
SELECT ad.category_id, ad.id, ad.label, ad.sort_order + 20, 1
FROM attribute_definitions ad
JOIN categories c ON c.id = ad.category_id
WHERE c.slug IN ('passives', 'led-display', 'semiconductors')
  AND ad.key IN ('resistance', 'capacitance', 'voltage', 'tolerance', 'power_rating', 'package', 'emitted_color', 'forward_voltage', 'forward_current', 'pins', 'interface')
  AND NOT EXISTS (
    SELECT 1 FROM category_list_headers h
    WHERE h.category_id = ad.category_id AND h.attribute_definition_id = ad.id
  );
