# Database Design

Database: Cloudflare D1

Migrations: `migrations/0001_initial.sql` から `migrations/0009_part_alternatives.sql` までを順に適用する。

## Design Principle

カテゴリごとに異なる電気的特性はDBカラムとして追加しない。共通項目は `parts` に置き、可変属性は `part_attributes` に `key/value/unit` 形式で保存する。

## Tables

### `categories`

部品カテゴリ。

- `id`: primary key
- `name`: 表示名
- `slug`: URL/API向け識別子。unique
- `created_at`, `updated_at`
- `parent_id`, `description`, `sort_order`

### `parts`

部品の共通項目。

- `id`: primary key
- `category_id`: `categories.id`
- `model_number`: 型番
- `name`: 部品名
- `stock_quantity`: 在庫数。0以上
- `price`: 価格
- `description`, `manufacturer`, `footprint`
- `location_id`: `locations.id`
- `case_number`: ケース番号
- `purchase_url`, `datasheet_url`
- `image_url`: 画像URL（migration 0002で追加）
- `memo`: メモ
- `low_stock_threshold`: 低在庫しきい値。0以上
- `search_text`: キーワード検索用の正規化テキスト
- `status_id`: `part_statuses.id`
- `archived_at`: アーカイブ日時
- `created_at`, `updated_at`

`category_id` は `ON DELETE RESTRICT`。部品があるカテゴリは削除できない。

### `part_attributes`

部品ごとの電気的特性。

- `id`: primary key
- `part_id`: `parts.id`
- `key`: 属性キー
- `label`: 表示名
- `value`: 値
- `unit`: 単位
- `normalized_value`: 検索・比較用の正規化値
- `created_at`, `updated_at`

`UNIQUE (part_id, key)` で同一部品内の属性キー重複を防ぐ。`parts` 削除時はCASCADEする。

### `tags`

タグマスタ。

- `id`: primary key
- `name`: 表示名
- `slug`: unique
- `created_at`, `updated_at`

### `part_tags`

部品とタグの中間テーブル。

- `part_id`
- `tag_id`

Primary keyは `(part_id, tag_id)`。部品またはタグ削除時はCASCADEする。

### `stock_movements`

在庫変更履歴。migration 0002 でカラム名を変更し `reason` を追加した。

- `id`: primary key
- `part_id`: `parts.id`
- `movement_type`: `initial`, `in`, `out`, `set`, `adjustment`, `use`, `return`, `dispose`
- `quantity_before`: 変更前在庫数
- `quantity_delta`: 変更量（差分）
- `quantity_after`: 変更後在庫数
- `reason`: 変更理由
- `memo`: 変更メモ
- `created_at`

### `locations`

保管場所。

- `id`: primary key
- `name`: 表示名
- `code`: unique
- `description`
- `created_at`, `updated_at`

### `part_statuses`

部品ステータス。

- `id`: primary key
- `name`: 表示名
- `slug`: unique
- `color`: 表示色
- `sort_order`: 表示順
- `created_at`, `updated_at`

### `attribute_definitions`

カテゴリ別の仕様項目定義。

- `id`: primary key
- `category_id`: `categories.id`
- `key`: 属性キー
- `label`: 表示名
- `data_type`: `text`, `number`, `boolean`, `date`
- `unit`, `group_name`
- `is_searchable`
- `sort_order`
- `created_at`, `updated_at`

### `part_attribute_values`

仕様項目定義に紐づく型付き属性値。

- `id`: primary key
- `part_id`: `parts.id`
- `attribute_definition_id`: `attribute_definitions.id`
- `value_text`, `value_number`
- `unit`, `display_value`
- `created_at`, `updated_at`

### `category_list_headers`

カテゴリ別の一覧表示ヘッダ。

- `id`: primary key
- `category_id`: `categories.id`
- `attribute_definition_id`: 任意の仕様項目
- `field_key`: 共通項目キー
- `label`
- `sort_order`
- `is_visible`

### `import_batches` / `import_batch_entries`

インポート履歴と取り消し用スナップショット。

- `import_batches`: mode, created/updated/skipped/failed件数, `created_at`, `reverted_at`
- `import_batch_entries`: batch_id, part_id, action, before_json

### `part_alternatives`

部品ごとの代替候補テキスト（migration 0009）。

- `id`: primary key
- `part_id`: `parts.id`。`ON DELETE CASCADE`
- `text`: 代替候補テキスト
- `sort_order`: 表示順
- `created_at`

### `projects` / `project_parts`（未使用）

migration 0002 で作成されているが、`src/` 配下にコード参照が一切なく、現状アプリからは未配線（orphan）のテーブル。将来のBOM/プロジェクト機能の名残と思われる。利用する場合は別途実装が必要。

- `projects`: `id`, `name`, `description`, `created_at`, `updated_at`
- `project_parts`: `id`, `project_id`（CASCADE）, `part_id`（CASCADE）, `quantity_required`, `memo`, `created_at`, `updated_at`

## Indexes

migration をまたいで以下が作成される。

### `parts`

- `idx_parts_category_id`
- `idx_parts_model_number`
- `idx_parts_case_number`
- `idx_parts_stock_quantity`
- `idx_parts_search_text`
- `idx_parts_archived_at`（0002）
- `idx_parts_location_id`（0002）
- `idx_parts_manufacturer`（0002）
- `idx_parts_footprint`（0002）
- `idx_parts_status_id`（0006）
- `idx_parts_archived_status_name_model`（0008、`archived_at, status_id, name COLLATE NOCASE, model_number COLLATE NOCASE, id` の複合一覧用）

### `part_attributes`

- `idx_part_attributes_part_id`
- `idx_part_attributes_key_value`

### `part_tags`

- `idx_part_tags_tag_id`

### `stock_movements`

- `idx_stock_movements_part_id_created_at`

### `attribute_definitions` / `part_attribute_values` / `category_list_headers`（0003）

- `idx_attribute_definitions_category_key`（unique）
- `idx_attribute_definitions_category_searchable`
- `idx_part_attribute_values_part_id`
- `idx_part_attribute_values_definition_text`
- `idx_part_attribute_values_definition_number`
- `idx_category_list_headers_category_order`

### `part_statuses`

- `idx_part_statuses_sort_order_name`（0008、`sort_order, name COLLATE NOCASE, id`）

### `import_batches` / `import_batch_entries`（0005）

- `idx_import_batch_entries_batch_id`
- `idx_import_batches_created_at`

### `part_alternatives`（0009）

- `idx_part_alternatives_part_id`

## Future Migration Notes

カテゴリ別export schemaをDB管理へ移す場合は、以下のような追加テーブルを想定する。

- `export_schemas`: カテゴリ、schema名、出力単位
- `export_schema_columns`: schemaごとの列定義、表示順、属性キー、表示名

現在は `ExportService` と `getExportSchema` の境界で取得元を差し替えられるようにしている。
