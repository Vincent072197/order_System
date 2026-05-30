-- Hot-path indexes. Add these as separate migrations as the workload grows.

CREATE INDEX idx_menu_items_restaurant_active
  ON menu_items (restaurant_id) WHERE is_available;

CREATE INDEX idx_menu_items_category_sort
  ON menu_items (category_id, sort_order);

CREATE INDEX idx_orders_restaurant_status_time
  ON orders (restaurant_id, status, created_at DESC);

CREATE INDEX idx_orders_table_open
  ON orders (table_id)
  WHERE status NOT IN ('completed', 'cancelled');

CREATE INDEX idx_order_items_order
  ON order_items (order_id);

CREATE INDEX idx_audit_log_entity
  ON audit_log (entity_kind, entity_id, occurred_at DESC);
