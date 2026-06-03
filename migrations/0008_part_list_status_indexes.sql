CREATE INDEX IF NOT EXISTS idx_part_statuses_sort_order_name ON part_statuses(sort_order, name COLLATE NOCASE, id);

CREATE INDEX IF NOT EXISTS idx_parts_archived_status_name_model ON parts(
  archived_at,
  status_id,
  name COLLATE NOCASE,
  model_number COLLATE NOCASE,
  id
);
