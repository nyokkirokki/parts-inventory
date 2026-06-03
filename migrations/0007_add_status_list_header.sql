INSERT INTO category_list_headers (category_id, field_key, label, sort_order, is_visible)
SELECT c.id, 'status', 'ステータス', 85, 1
FROM categories c
WHERE NOT EXISTS (
  SELECT 1
  FROM category_list_headers h
  WHERE h.category_id = c.id AND h.field_key = 'status'
);
