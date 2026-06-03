ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id);
ALTER TABLE categories ADD COLUMN description TEXT;
ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE parts ADD COLUMN description TEXT;
ALTER TABLE parts ADD COLUMN manufacturer TEXT;
ALTER TABLE parts ADD COLUMN footprint TEXT;
ALTER TABLE parts ADD COLUMN location_id INTEGER REFERENCES locations(id);
ALTER TABLE parts ADD COLUMN purchase_url TEXT;
ALTER TABLE parts ADD COLUMN datasheet_url TEXT;
ALTER TABLE parts ADD COLUMN image_url TEXT;
ALTER TABLE parts ADD COLUMN archived_at TEXT;

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  quantity_required INTEGER NOT NULL DEFAULT 1,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);

CREATE TABLE stock_movements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('initial', 'in', 'out', 'set', 'adjustment', 'use', 'return', 'dispose')),
  quantity_before INTEGER NOT NULL,
  quantity_delta INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);

INSERT INTO stock_movements_new (id, part_id, movement_type, quantity_before, quantity_delta, quantity_after, reason, memo, created_at)
SELECT id, part_id, type, before_quantity, quantity, after_quantity, type, memo, created_at FROM stock_movements;

DROP TABLE stock_movements;
ALTER TABLE stock_movements_new RENAME TO stock_movements;

CREATE INDEX IF NOT EXISTS idx_parts_archived_at ON parts(archived_at);
CREATE INDEX IF NOT EXISTS idx_parts_location_id ON parts(location_id);
CREATE INDEX IF NOT EXISTS idx_parts_manufacturer ON parts(manufacturer);
CREATE INDEX IF NOT EXISTS idx_parts_footprint ON parts(footprint);
CREATE INDEX IF NOT EXISTS idx_stock_movements_part_id_created_at ON stock_movements(part_id, created_at DESC);

INSERT OR IGNORE INTO locations (id, name, code, description) VALUES
  (1, '棚A-01', 'A-01', '受動部品ケース'),
  (2, '棚A-02', 'A-02', 'コンデンサケース'),
  (3, '棚B-01', 'B-01', '半導体トレイ'),
  (4, '棚C-01', 'C-01', '開発ボード'),
  (5, '工具箱', 'TOOLS', '工具・工作用品');

INSERT OR IGNORE INTO categories (id, name, slug, description, sort_order) VALUES
  (1, '半導体', 'semiconductors', 'IC、トランジスタ、MOSFET、オペアンプなど', 10),
  (2, '受動部品', 'passives', '抵抗、コンデンサ、インダクタなど', 20),
  (3, 'LED・表示器', 'led-display', 'LED、表示器、7セグメントなど', 30),
  (4, 'センサー', 'sensors', '温度、光、距離、電流などのセンサー', 40),
  (5, 'マイコン・開発ボード', 'mcus-boards', 'マイコン、評価ボード、開発ボード', 50),
  (6, '電源・電池', 'power-battery', 'DC-DC、電源モジュール、電池', 60),
  (7, 'ケーブル・コネクター', 'cables-connectors', 'ピンヘッダ、ケーブル、端子台', 70),
  (8, '基板・ブレッドボード', 'pcb-breadboard', '基板、ブレッドボード、ユニバーサル基板', 80),
  (9, '工具・工作用品', 'tools', '工具、はんだ用品、加工用品', 90),
  (10, 'ケース・ネジ・固定具', 'cases-fasteners', 'ケース、ネジ、スペーサー', 100),
  (11, '無線・通信モジュール', 'wireless-modules', 'Wi-Fi、Bluetooth、無線モジュール', 110),
  (12, 'モーター・駆動部品', 'motors-drivers', 'モーター、ドライバ、リレー', 120),
  (13, '測定器・計測器', 'measurement', 'テスター、ロジアナ、計測器', 130),
  (14, 'その他', 'others', 'その他の部品', 140);

INSERT OR IGNORE INTO tags (name, slug) VALUES ('よく使う', 'frequent'), ('発注候補', 'to-order'), ('試作', 'prototype');

INSERT OR IGNORE INTO parts (
  id, category_id, model_number, name, description, manufacturer, footprint, stock_quantity, low_stock_threshold,
  location_id, case_number, price, purchase_url, datasheet_url, memo, search_text
) VALUES
  (1, 2, '10K-1/4W-CF', '抵抗 10kΩ 1/4W', '炭素皮膜抵抗 5% リード品', 'KOA', 'Axial', 120, 20, 1, 'R-001', 1.2, 'https://akizukidenshi.com/', 'https://example.com/resistor.pdf', 'LED電流制限やプルアップ用', '10k 10kΩ resistor koa axial 抵抗'),
  (2, 2, 'C-0.1UF-50V-X7R', '積層セラミックコンデンサ 0.1μF 50V', 'X7R 0.1uF バイパス用', 'Murata', '0603', 5, 30, 2, 'C-014', 3.5, 'https://akizukidenshi.com/', 'https://example.com/capacitor.pdf', '電源デカップリング標準品', '0.1uf 50v x7r capacitor murata 0603 コンデンサ'),
  (3, 2, 'ECA-100UF-16V', '電解コンデンサ 100μF 16V', 'ラジアルリード電解コンデンサ', 'Panasonic', 'Radial', 42, 10, 2, 'C-101', 18, 'https://akizukidenshi.com/', '', '', '100uf 16v electrolytic capacitor panasonic'),
  (4, 3, 'LED-RED-5MM', 'LED 赤 5mm', '赤色砲弾型LED', 'OptoSupply', 'THT 5mm', 0, 20, 1, 'LED-RED', 8, 'https://akizukidenshi.com/', '', '要補充', 'red led 5mm led'),
  (5, 7, 'TACT-6X6', 'タクトスイッチ', '6x6mm 高さ5mm', 'ALPS', 'THT 6x6', 80, 20, 1, 'SW-006', 12, '', '', '', 'tact switch 6x6 タクトスイッチ'),
  (6, 7, 'PH-2.54-1X40', 'ピンヘッダ 2.54mm', '1x40 ストレート', 'Generic', '2.54mm', 35, 10, 1, 'CN-040', 35, '', '', '', 'pin header 2.54mm connector'),
  (7, 1, 'ATMEGA328P-PU', 'ATmega328P', '8-bit AVR マイコン DIP-28', 'Microchip', 'DIP-28', 12, 5, 3, 'IC-AVR', 390, '', 'https://example.com/atmega328p.pdf', '', 'atmega328p microchip dip28 mcu'),
  (8, 5, 'ESP32-DEVKITC', 'ESP32開発ボード', 'Wi-Fi/Bluetooth 開発ボード', 'Espressif', 'DevKit', 8, 3, 4, 'DEV-ESP32', 780, '', 'https://example.com/esp32.pdf', '', 'esp32 wifi bluetooth devkit'),
  (9, 5, 'RPI-PICO', 'Raspberry Pi Pico', 'RP2040搭載マイコンボード', 'Raspberry Pi', 'Pico', 15, 4, 4, 'DEV-PICO', 650, '', 'https://example.com/pico.pdf', '', 'raspberry pi pico rp2040'),
  (10, 8, 'BB-400', 'ブレッドボード', '400穴 ソルダーレス', 'Sunhayato', '400 tie', 6, 2, 4, 'BRD-400', 280, '', '', '', 'breadboard 400'),
  (11, 7, 'JW-M2M-20', 'ジャンパーワイヤ', 'オス-オス 20本セット', 'Generic', 'Dupont', 25, 5, 1, 'WIRE-MM', 120, '', '', '', 'jumper wire dupont'),
  (12, 11, 'FT232RL-MOD', 'USBシリアル変換モジュール', 'FT232RL搭載 USB-UART', 'FTDI', 'Module', 3, 2, 3, 'MOD-UART', 680, '', 'https://example.com/ft232.pdf', '', 'usb serial uart ft232rl'),
  (13, 1, 'IRLML2502', 'Nch MOSFET', 'ロジックレベルNch MOSFET', 'Infineon', 'SOT-23', 64, 15, 3, 'TR-FET', 28, '', 'https://example.com/mosfet.pdf', '', 'nch mosfet sot23 logic level'),
  (14, 1, 'LM358N', 'オペアンプ', 'デュアル低消費電力オペアンプ', 'TI', 'DIP-8', 18, 6, 3, 'IC-OP', 45, '', 'https://example.com/lm358.pdf', '', 'lm358 opamp dip8'),
  (15, 1, 'TLP521-1', 'フォトカプラ', '汎用フォトトランジスタ出力', 'Toshiba', 'DIP-4', 22, 8, 3, 'IC-ISO', 55, '', '', '', 'photocoupler optocoupler'),
  (16, 4, 'DS18B20', '温度センサー', '1-Wire デジタル温度センサー', 'Maxim', 'TO-92', 9, 5, 3, 'SENS-TMP', 210, '', 'https://example.com/ds18b20.pdf', '', 'temperature sensor one wire ds18b20'),
  (17, 6, 'MP1584-MOD', 'DC-DCコンバータ', '降圧型可変DC-DCモジュール', 'MPS', 'Module', 4, 5, 4, 'PWR-BUCK', 160, '', '', '最低在庫以下', 'dc-dc buck converter mp1584');

INSERT OR IGNORE INTO part_attributes (part_id, key, label, value, unit, normalized_value) VALUES
  (1, 'resistance', '抵抗値', '10', 'kΩ', '10kohm'),
  (1, 'tolerance', '許容差', '5', '%', '5%'),
  (2, 'capacitance', '静電容量', '0.1', 'μF', '0.1uf'),
  (2, 'voltage', '定格電圧', '50', 'V', '50v'),
  (2, 'package', 'パッケージ', '0603', '', '0603'),
  (3, 'capacitance', '静電容量', '100', 'μF', '100uf'),
  (3, 'voltage', '定格電圧', '16', 'V', '16v'),
  (7, 'pins', 'ピン数', '28', '', '28'),
  (8, 'communication', '通信方式', 'Wi-Fi/Bluetooth', '', 'wifi bluetooth'),
  (9, 'supply_voltage', '電源電圧', '3.3', 'V', '3.3v'),
  (12, 'interface', 'インターフェース', 'USB-UART', '', 'usb-uart'),
  (13, 'package', 'パッケージ', 'SOT-23', '', 'sot-23'),
  (16, 'interface', 'インターフェース', '1-Wire', '', '1-wire'),
  (17, 'output', '出力形式', '降圧', '', 'buck');
